import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity, Alert, 
  StatusBar, Modal, ScrollView, Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';

const SKINS = {
  classic: { name: 'Pets Clássicos', price: 0, symbols: ['🐶', '🐱', '🦴', '🐾', '🎰', '💎', '🐕', '🐈'] },
  neon: { name: 'Pets Cyber Neon', price: 300, symbols: ['🤖', '⚡', '🛸', '👾', '💎', '🔮', '🚀', '🌟'] },
  magic: { name: 'Pets Mágicos', price: 600, symbols: ['🦄', '🐉', '✨', '👑', '🔮', '🌙', '⭐', '🎆'] }
};

const GRID_SIZE = 5;

// Código HTML/JS que roda dentro da WebView invisível para tocar os sons via Web Audio API
const audioEngineHTML = `
  <!DOCTYPE html>
  <html>
    <head>
      <script>
        let audioCtx = null;

        function initAudio() {
          if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          }
          if (audioCtx.state === 'suspended') {
            audioCtx.resume();
          }
        }

        function playSpinSound() {
          initAudio();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(300, audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
          gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.15);
        }

        function playWinSound() {
          initAudio();
          const now = audioCtx.currentTime;
          const notes = [523.25, 659.25, 783.99, 1046.50]; // Notas Do, Mi, Sol, Do (Acorde de vitória)
          notes.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + (i * 0.08));
            gain.gain.setValueAtTime(0.2, now + (i * 0.08));
            gain.gain.exponentialRampToValueAtTime(0.001, now + (i * 0.08) + 0.3);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now + (i * 0.08));
            osc.stop(now + (i * 0.08) + 0.3);
          });
        }

        document.addEventListener('message', function(event) {
          const type = event.data;
          if (type === 'spin') playSpinSound();
          if (type === 'win') playWinSound();
        });
      </script>
    </head>
    <body style="background:transparent;"></body>
  </html>
`;

export default function App() {
  const [coins, setCoins] = useState(200);
  const [bet, setBet] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [activeSkin, setActiveSkin] = useState('classic');
  const [ownedSkins, setOwnedSkins] = useState(['classic']);
  const [grid, setGrid] = useState(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill('🐶')));
  
  const [shopModal, setShopModal] = useState(false);
  const [leaderboardModal, setLeaderboardModal] = useState(false);
  const [highScore, setHighScore] = useState(200);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const webViewRef = useRef(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (coins > highScore) {
      setHighScore(coins);
      AsyncStorage.setItem('@highscore', JSON.stringify(coins));
    }
    AsyncStorage.setItem('@coins', JSON.stringify(coins));
  }, [coins]);

  const loadData = async () => {
    try {
      const savedCoins = await AsyncStorage.getItem('@coins');
      const savedSkins = await AsyncStorage.getItem('@owned_skins');
      const savedHighScore = await AsyncStorage.getItem('@highscore');
      if (savedCoins) setCoins(JSON.parse(savedCoins));
      if (savedSkins) setOwnedSkins(JSON.parse(savedSkins));
      if (savedHighScore) setHighScore(JSON.parse(savedHighScore));
    } catch (e) {}
  };

  // Envia comando para a WebView tocar o som
  const sendSoundCommand = (soundType) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(soundType);
    }
  };

  const spin = () => {
    if (coins < bet) {
      Alert.alert('Saldo Insuficiente 🐾', 'Acumule mais moedas para continuar jogando!');
      return;
    }

    setSpinning(true);
    setCoins(prev => prev - bet);
    sendSoundCommand('spin');

    spinAnim.setValue(0);
    Animated.timing(spinAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();

    const symbols = SKINS[activeSkin].symbols;
    let counter = 0;
    const interval = setInterval(() => {
      const newGrid = Array(GRID_SIZE).fill(null).map(() => 
        Array(GRID_SIZE).fill(null).map(() => symbols[Math.floor(Math.random() * symbols.length)])
      );
      setGrid(newGrid);
      
      if (++counter > 8) {
        clearInterval(interval);
        setSpinning(false);
        checkWins(newGrid);
      }
    }, 100);
  };

  const checkWins = (currentGrid) => {
    let win = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      const first = currentGrid[r][0];
      if (currentGrid[r].every(s => s === first)) win += bet * 5;
    }

    if (win > 0 || Math.random() > 0.6) {
      const finalPrize = win > 0 ? win : bet * 2;
      sendSoundCommand('win');
      setCoins(prev => prev + finalPrize);
      Alert.alert('Vitória! 🎉', `Você ganhou +${finalPrize} moedas virtuais!`);
    }
  };

  const buyOrSelectSkin = async (key) => {
    const skin = SKINS[key];
    if (ownedSkins.includes(key)) {
      setActiveSkin(key);
    } else if (coins >= skin.price) {
      const newCoins = coins - skin.price;
      const newOwned = [...ownedSkins, key];
      setCoins(newCoins);
      setOwnedSkins(newOwned);
      setActiveSkin(key);
      await AsyncStorage.setItem('@owned_skins', JSON.stringify(newOwned));
    } else {
      Alert.alert('Moedas Insuficientes', `Custa ${skin.price} moedas.`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* WebView invisível carregada no fundo exclusivamente para processar áudio HTML5 */}
      <View style={{ width: 0, height: 0, opacity: 0 }}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: audioEngineHTML }}
          javaScriptEnabled={true}
        />
      </View>

      <View style={styles.header}>
        <View style={styles.coinBadge}>
          <Text style={styles.coinText}>🪙 {coins}</Text>
        </View>
        <TouchableOpacity style={styles.topBtn} onPress={() => setShopModal(true)}>
          <Text style={styles.topBtnText}>🎨 Loja</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.topBtn} onPress={() => setLeaderboardModal(true)}>
          <Text style={styles.topBtnText}>🏆 Rank</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>🐶 Help Pets Slots 🎰</Text>
      <Text style={styles.subtitle}>Tema: {SKINS[activeSkin].name}</Text>

      <View style={styles.gridContainer}>
        {grid.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((s, c) => (
              <Animated.View 
                key={c} 
                style={[
                  styles.cell, 
                  spinning && { transform: [{ rotateX: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }
                ]}
              >
                <Text style={styles.cellText}>{s}</Text>
              </Animated.View>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.betRow}>
        <Text style={styles.betLabel}>Aposta:</Text>
        {[10, 20, 50].map(v => (
          <TouchableOpacity 
            key={v} 
            style={[styles.betBtn, bet === v && styles.betBtnActive]} 
            onPress={() => setBet(v)}
            disabled={spinning}
          >
            <Text style={styles.betBtnText}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.spinButton} onPress={spin} disabled={spinning}>
        <Text style={styles.spinBtnText}>{spinning ? 'Girando...' : `🎰 GIRAR (${bet} Moedas)`}</Text>
      </TouchableOpacity>

      {/* Modal Loja */}
      <Modal visible={shopModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🎨 Loja de Skins Virtuais</Text>
            <ScrollView style={{ width: '100%', marginVertical: 10 }}>
              {Object.keys(SKINS).map(key => {
                const item = SKINS[key];
                const isOwned = ownedSkins.includes(key);
                const isActive = activeSkin === key;
                return (
                  <View key={key} style={styles.shopCard}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>{item.name}</Text>
                    <TouchableOpacity 
                      style={[styles.buyBtn, isActive && { backgroundColor: '#64748b' }]} 
                      onPress={() => buyOrSelectSkin(key)}
                    >
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                        {isActive ? 'Em Uso' : isOwned ? 'Usar' : `${item.price} 🪙`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity onPress={() => setShopModal(false)}>
              <Text style={{ color: '#94a3b8', padding: 10 }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Rank */}
      <Modal visible={leaderboardModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🏆 Recorde Local</Text>
            <Text style={{ color: '#facc15', fontSize: 22, fontWeight: 'bold', marginVertical: 20 }}>
              {highScore} Moedas
            </Text>
            <TouchableOpacity onPress={() => setLeaderboardModal(false)}>
              <Text style={{ color: '#94a3b8', padding: 10 }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10, marginBottom: 15 },
  coinBadge: { backgroundColor: '#1e293b', padding: 8, borderRadius: 20, borderWidth: 1, borderColor: '#facc15' },
  coinText: { color: '#facc15', fontWeight: 'bold' },
  topBtn: { backgroundColor: '#334155', padding: 8, borderRadius: 16 },
  topBtnText: { color: '#fff', fontWeight: 'bold' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 13, color: '#38bdf8', marginBottom: 15 },
  gridContainer: { backgroundColor: '#0284c7', padding: 8, borderRadius: 16, marginBottom: 20 },
  row: { flexDirection: 'row' },
  cell: { width: 55, height: 55, backgroundColor: '#1e293b', margin: 2, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cellText: { fontSize: 26 },
  betRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  betLabel: { color: '#fff', fontWeight: 'bold', marginRight: 10 },
  betBtn: { backgroundColor: '#334155', padding: 8, paddingHorizontal: 16, borderRadius: 8, marginHorizontal: 4 },
  betBtnActive: { backgroundColor: '#0284c7' },
  betBtnText: { color: '#fff', fontWeight: 'bold' },
  spinButton: { backgroundColor: '#10b981', padding: 16, borderRadius: 12, width: '100%', alignItems: 'center' },
  spinBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1e293b', padding: 20, borderRadius: 20, width: '100%', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  shopCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: 12, borderRadius: 10, marginBottom: 8 },
  buyBtn: { backgroundColor: '#10b981', padding: 8, borderRadius: 6 }
});
