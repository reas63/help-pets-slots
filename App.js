import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity, Alert, 
  StatusBar, Modal, Linking, ScrollView, Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';

const SYMBOLS = ['🐶', '🐱', '🦴', '🐾', '🎰', '💎', '🐕', '🐈'];
const PAYPAL_URL = 'https://www.paypal.com/donate?business=reas63@hotmail.com&amount=1.00&currency_code=BRL';
const GRID_SIZE = 5;

export default function App() {
  const [grid, setGrid] = useState([
    ['🐶', '🐱', '🦴', '🐾', '💎'], ['🐾', '🐶', '💎', '🦴', '🐱'],
    ['🦴', '💎', '🐶', '🐾', '🎰'], ['🐱', '🐾', '🎰', '🐶', '💎'],
    ['💎', '🦴', '🐱', '🎰', '🐶'],
  ]);
  const [coins, setCoins] = useState(100);
  const [bet, setBet] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [winLogs, setWinLogs] = useState([]);

  const spinAnim = useRef(new Animated.Value(0)).current;

  // Sistema de Efeitos Sonoros do Jogo (Garantido sem travar o App)
  const playSoundEffect = (type) => {
    try {
      if (type === 'spin') {
        Speech.speak('GIRANDO!', { language: 'pt-BR', pitch: 1.5, rate: 1.2 });
      } else if (type === 'win') {
        Speech.speak('PARABÉNS! VOCÊ GANHOU!', { language: 'pt-BR', pitch: 1.2, rate: 1.0 });
      } else if (type === 'jackpot') {
        Speech.speak('JACKPOT! SENSACIONAL!', { language: 'pt-BR', pitch: 1.4, rate: 1.0 });
      }
    } catch (e) {}
  };

  useEffect(() => { loadSavedData(); }, []);
  useEffect(() => { saveCoins(coins); }, [coins]);

  const loadSavedData = async () => {
    try {
      const savedCoins = await AsyncStorage.getItem('@help_pets_coins');
      const savedLogs = await AsyncStorage.getItem('@help_pets_win_logs');
      if (savedCoins !== null) setCoins(JSON.parse(savedCoins));
      if (savedLogs !== null) setWinLogs(JSON.parse(savedLogs));
    } catch (e) {}
  };

  const saveCoins = async (value) => {
    try { await AsyncStorage.setItem('@help_pets_coins', JSON.stringify(value)); } catch (e) {}
  };

  const addWinLog = async (type, prize) => {
    const timeStr = new Date().toLocaleTimeString();
    const newEntry = { id: Date.now().toString(), type, prize, time: timeStr };
    const updatedLogs = [newEntry, ...winLogs].slice(0, 30);
    setWinLogs(updatedLogs);
    try { await AsyncStorage.setItem('@help_pets_win_logs', JSON.stringify(updatedLogs)); } catch (e) {}
  };

  const checkWins = (currentGrid) => {
    let totalWin = 0;
    let jackpot = false;

    const evaluateLine = (line) => {
      const counts = {};
      line.forEach(s => counts[s] = (counts[s] || 0) + 1);
      for (const s in counts) {
        if (counts[s] === 5) { jackpot = true; return 500; }
        else if (counts[s] >= 3) return 30;
      }
      return 0;
    };
    
    for (let i = 0; i < 5; i++) totalWin += evaluateLine(currentGrid[i]);

    if (jackpot) {
      playSoundEffect('jackpot');
      setCoins(prev => prev + totalWin);
      addWinLog('SUPER JACKPOT 👑', totalWin);
      Alert.alert('SUPER JACKPOT! 👑', `Parabéns! Você ganhou ${totalWin} moedas!`);
    } else if (totalWin > 0) {
      playSoundEffect('win');
      setCoins(prev => prev + totalWin);
      addWinLog('Vitória 🐾', totalWin);
      Alert.alert('Combinação Campeã! 🐾', `Você acertou e ganhou ${totalWin} moedas!`);
    }
  };

  const spin = () => {
    if (coins < bet) {
      Alert.alert(
        'Saldo Insuficiente 🐾', 
        'Suas moedas acabaram! Apoie o projeto via PayPal para recarregar.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Apoiar R$ 1,00', onPress: () => setModalVisible(true) }
        ]
      );
      return;
    }

    setSpinning(true);
    setCoins(prev => prev - bet);
    playSoundEffect('spin');

    // Animação 3D dos Slots
    spinAnim.setValue(0);
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true
    }).start();

    let counter = 0;
    const interval = setInterval(() => {
      const newGrid = Array(GRID_SIZE).fill(null).map(() => 
        Array(GRID_SIZE).fill(null).map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
      );
      setGrid(newGrid);
      if (++counter > 10) { 
        clearInterval(interval); 
        setSpinning(false); 
        checkWins(newGrid); 
      }
    }, 90);
  };

  const spin3D = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>🐶 Help Pets Slots 🎰</Text>
        <Text style={styles.subtitle}>Grade 5x5 com Som e Animação 3D</Text>

        <View style={styles.scoreRow}>
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreText}>🪙 Saldo: {coins}</Text>
          </View>
          <TouchableOpacity 
            style={styles.historyButton} 
            onPress={() => setHistoryModalVisible(true)}
          >
            <Text style={styles.historyButtonText}>📜 Ganhos</Text>
          </TouchableOpacity>
        </View>

        {/* Grade 5x5 com Animação 3D */}
        <View style={styles.gridContainer}>
          {grid.map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((s, c) => (
                <Animated.View 
                  key={c} 
                  style={[
                    styles.cell, 
                    spinning && { transform: [{ rotateX: spin3D }] }
                  ]}
                >
                  <Text style={styles.cellText}>{s}</Text>
                </Animated.View>
              ))}
            </View>
          ))}
        </View>

        {/* Apostas */}
        <View style={styles.betContainer}>
          <Text style={styles.betLabel}>Aposta:</Text>
          {[10, 20, 50].map(val => (
            <TouchableOpacity 
              key={val} 
              style={[styles.betButton, bet === val && styles.betButtonActive]} 
              onPress={() => setBet(val)}
              disabled={spinning}
            >
              <Text style={styles.betButtonText}>{val}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity 
          style={[styles.spinButton, spinning && styles.buttonDisabled]} 
          onPress={spin} 
          disabled={spinning}
        >
          <Text style={styles.spinButtonText}>
            {spinning ? 'Girando 3D...' : `🎰 GIRAR (${bet} Moedas)`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.paypalButton} onPress={() => setModalVisible(true)}>
          <Text style={styles.paypalButtonText}>💙 Apoiar com PayPal (R$ 1,00)</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal PayPal */}
      <Modal animationType="slide" transparent={true} visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Apoie os Pets 🐾</Text>
            <Text style={styles.modalDescription}>Doe R$ 1,00 via PayPal para ajudar a causa e ganhe 150 moedas.</Text>
            <TouchableOpacity style={styles.confirmButton} onPress={() => Linking.openURL(PAYPAL_URL)}>
              <Text style={styles.confirmButtonText}>Ir para PayPal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Histórico */}
      <Modal animationType="slide" transparent={true} visible={historyModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📜 Registro de Ganhos</Text>
            <ScrollView style={{ width: '100%', marginBottom: 16 }}>
              {winLogs.length === 0 ? (
                <Text style={{ color: '#94a3b8', textAlign: 'center', marginVertical: 20 }}>Nenhum ganho ainda.</Text>
              ) : (
                winLogs.map(item => (
                  <View key={item.id} style={styles.logItem}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>{item.type}</Text>
                    <Text style={{ color: '#10b981', fontWeight: 'bold' }}>+{item.prize} 🪙</Text>
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.closeButton} onPress={() => setHistoryModalVisible(false)}>
              <Text style={styles.closeButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { alignItems: 'center', padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#f8fafc', marginTop: 10 },
  subtitle: { fontSize: 13, color: '#38bdf8', marginBottom: 16 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  scoreContainer: { backgroundColor: '#1e293b', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#334155', marginRight: 10 },
  scoreText: { color: '#facc15', fontSize: 16, fontWeight: 'bold' },
  historyButton: { backgroundColor: '#334155', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20 },
  historyButtonText: { color: '#38bdf8', fontWeight: 'bold' },
  gridContainer: { backgroundColor: '#0284c7', padding: 6, borderRadius: 16, marginBottom: 20 },
  row: { flexDirection: 'row' },
  cell: { width: 58, height: 58, backgroundColor: '#1e293b', margin: 3, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#0284c7' },
  cellText: { fontSize: 28 },
  betContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  betLabel: { color: '#f8fafc', fontWeight: 'bold', marginRight: 10 },
  betButton: { backgroundColor: '#334155', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, marginHorizontal: 4 },
  betButtonActive: { backgroundColor: '#0284c7' },
  betButtonText: { color: '#fff', fontWeight: 'bold' },
  spinButton: { backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 12, width: '100%', alignItems: 'center', marginBottom: 12 },
  spinButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  buttonDisabled: { backgroundColor: '#64748b' },
  paypalButton: { backgroundColor: '#0070ba', paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center' },
  paypalButtonText: { color: '#fff', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1e293b', padding: 24, borderRadius: 20, width: '100%', alignItems: 'center', maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  modalDescription: { color: '#cbd5e1', textAlign: 'center', marginBottom: 20 },
  logItem: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#0f172a', padding: 12, borderRadius: 10, marginBottom: 8 },
  confirmButton: { backgroundColor: '#0070ba', padding: 14, borderRadius: 10, width: '100%', alignItems: 'center', marginBottom: 10 },
  confirmButtonText: { color: '#fff', fontWeight: 'bold' },
  closeButton: { padding: 10 },
  closeButtonText: { color: '#94a3b8' }
});
