import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  SafeAreaView, 
  TouchableOpacity, 
  Alert, 
  StatusBar, 
  Modal, 
  Linking,
  ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SYMBOLS = ['🐶', '🐱', '🦴', '🐾', '🎰', '💎', '🐕', '🐈'];
const PAYPAL_URL = 'https://www.paypal.com/donate?business=reas63@hotmail.com&amount=1.00&currency_code=BRL';
const GRID_SIZE = 5;

const STORAGE_COINS_KEY = '@help_pets_coins';
const STORAGE_LOGS_KEY = '@help_pets_win_logs';

export default function App() {
  const [grid, setGrid] = useState([
    ['🐶', '🐱', '🦴', '🐾', '💎'],
    ['🐾', '🐶', '💎', '🦴', '🐱'],
    ['🦴', '💎', '🐶', '🐾', '🎰'],
    ['🐱', '🐾', '🎰', '🐶', '💎'],
    ['💎', '🦴', '🐱', '🎰', '🐶'],
  ]);

  const [coins, setCoins] = useState(100);
  const [bet, setBet] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [winLogs, setWinLogs] = useState([]);

  useEffect(() => {
    loadSavedData();
  }, []);

  useEffect(() => {
    saveCoins(coins);
  }, [coins]);

  const loadSavedData = async () => {
    try {
      const savedCoins = await AsyncStorage.getItem(STORAGE_COINS_KEY);
      const savedLogs = await AsyncStorage.getItem(STORAGE_LOGS_KEY);
      if (savedCoins !== null) setCoins(JSON.parse(savedCoins));
      if (savedLogs !== null) setWinLogs(JSON.parse(savedLogs));
    } catch (e) {
      console.error('Erro ao carregar dados:', e);
    }
  };

  const saveCoins = async (value) => {
    try {
      await AsyncStorage.setItem(STORAGE_COINS_KEY, JSON.stringify(value));
    } catch (e) {
      console.error('Erro ao salvar moedas:', e);
    }
  };

  const addWinLog = async (type, prize, lines) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    const newEntry = {
      id: Date.now().toString(),
      time: timeStr,
      type: type,
      prize: prize,
      lines: lines
    };

    const updatedLogs = [newEntry, ...winLogs].slice(0, 30);
    setWinLogs(updatedLogs);
    try {
      await AsyncStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(updatedLogs));
    } catch (e) {
      console.error('Erro ao salvar histórico:', e);
    }
  };

  const checkWins = (currentGrid) => {
    let totalWin = 0;
    let jackpotCount = 0;
    let linesWon = 0;

    const evaluateLine = (line) => {
      const counts = {};
      line.forEach(symbol => counts[symbol] = (counts[symbol] || 0) + 1);

      let linePrize = 0;
      let isJackpot = false;

      for (const symbol in counts) {
        if (counts[symbol] === 5) {
          linePrize += 500;
          isJackpot = true;
        } else if (counts[symbol] >= 3) {
          linePrize += 30;
        }
      }
      return { linePrize, isJackpot };
    };

    // 1. Horizontais
    for (let r = 0; r < GRID_SIZE; r++) {
      const res = evaluateLine(currentGrid[r]);
      if (res.linePrize > 0) linesWon++;
      if (res.isJackpot) jackpotCount++;
      totalWin += res.linePrize;
    }

    // 2. Verticais
    for (let c = 0; c < GRID_SIZE; c++) {
      const col = [currentGrid[0][c], currentGrid[1][c], currentGrid[2][c], currentGrid[3][c], currentGrid[4][c]];
      const res = evaluateLine(col);
      if (res.linePrize > 0) linesWon++;
      if (res.isJackpot) jackpotCount++;
      totalWin += res.linePrize;
    }

    // 3. Diagonais
    const diag1 = [currentGrid[0][0], currentGrid[1][1], currentGrid[2][2], currentGrid[3][3], currentGrid[4][4]];
    const resD1 = evaluateLine(diag1);
    if (resD1.linePrize > 0) linesWon++;
    if (resD1.isJackpot) jackpotCount++;
    totalWin += resD1.linePrize;

    const diag2 = [currentGrid[0][4], currentGrid[1][3], currentGrid[2][2], currentGrid[3][1], currentGrid[4][0]];
    const resD2 = evaluateLine(diag2);
    if (resD2.linePrize > 0) linesWon++;
    if (resD2.isJackpot) jackpotCount++;
    totalWin += resD2.linePrize;

    if (jackpotCount > 0) {
      setCoins(prev => prev + totalWin);
      addWinLog('SUPER JACKPOT 👑', totalWin, linesWon);
      Alert.alert('SUPER JACKPOT! 👑', `Parabéns! Você ganhou ${totalWin} moedas!`);
    } else if (totalWin > 0) {
      setCoins(prev => prev + totalWin);
      addWinLog('Vitória 🐾', totalWin, linesWon);
      Alert.alert('Combinação Campeã! 🐾', `Você acertou ${linesWon} linha(s) e ganhou ${totalWin} moedas!`);
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

    let counter = 0;
    const interval = setInterval(() => {
      const newGrid = Array(GRID_SIZE).fill(null).map(() => 
        Array(GRID_SIZE).fill(null).map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
      );

      setGrid(newGrid);
      counter++;

      if (counter > 12) {
        clearInterval(interval);
        setSpinning(false);
        checkWins(newGrid);
      }
    }, 90);
  };

  const openPayPal = async () => {
    const supported = await Linking.canOpenURL(PAYPAL_URL);
    if (supported) {
      await Linking.openURL(PAYPAL_URL);
      setCoins(prev => prev + 150);
      addWinLog('Apoio Recebido ❤️', 150, 0);
      setModalVisible(false);
      Alert.alert('Muito Obrigado! ❤️', '150 moedas adicionadas!');
    } else {
      Alert.alert('Erro', 'Não foi possível abrir o PayPal.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>🐶 Help Pets Slots 🎰</Text>
        <Text style={styles.subtitle}>Grade 5x5: 12 Linhas de Vitória!</Text>

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

        {/* Grade 5x5 */}
        <View style={styles.gridContainer}>
          {grid.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((symbol, colIndex) => (
                <View key={colIndex} style={styles.cell}>
                  <Text style={styles.cellText}>{symbol}</Text>
                </View>
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

        {/* Botões */}
        <TouchableOpacity 
          style={[styles.spinButton, spinning && styles.buttonDisabled]} 
          onPress={spin} 
          disabled={spinning}
        >
          <Text style={styles.spinButtonText}>
            {spinning ? 'Girando 5x5...' : `🎰 GIRAR (${bet} Moedas)`}
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
            <Text style={styles.modalDescription}>
              Doe R$ 1,00 via PayPal para ajudar na causa dos animais e receba 150 moedas para jogar na grade 5x5.
            </Text>
            <TouchableOpacity style={styles.confirmButton} onPress={openPayPal}>
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
            <ScrollView style={styles.logList}>
              {winLogs.length === 0 ? (
                <Text style={styles.noLogsText}>Nenhum ganho registrado ainda. Faça um giro!</Text>
              ) : (
                winLogs.map(item => (
                  <View key={item.id} style={styles.logItem}>
                    <View>
                      <Text style={styles.logTitle}>{item.type}</Text>
                      <Text style={styles.logTime}>{item.time} hs</Text>
                    </View>
                    <Text style={styles.logPrize}>+{item.prize} 🪙</Text>
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
  historyButtonText: { color: '#38bdf8', fontWeight: 'bold', fontSize: 14 },

  gridContainer: { backgroundColor: '#0284c7', padding: 6, borderRadius: 16, marginBottom: 20 },
  row: { flexDirection: 'row' },
  cell: { width: 58, height: 58, backgroundColor: '#1e293b', margin: 3, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
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
  paypalButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1e293b', padding: 24, borderRadius: 20, width: '100%', alignItems: 'center', maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  modalDescription: { color: '#cbd5e1', textAlign: 'center', marginBottom: 20, fontSize: 14 },
  
  logList: { width: '100%', marginBottom: 16 },
  logItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: 12, borderRadius: 10, marginBottom: 8 },
  logTitle: { color: '#f8fafc', fontWeight: 'bold', fontSize: 14 },
  logTime: { color: '#64748b', fontSize: 12 },
  logPrize: { color: '#10b981', fontWeight: 'bold', fontSize: 16 },
  noLogsText: { color: '#94a3b8', textAlign: 'center', marginVertical: 20 },

  confirmButton: { backgroundColor: '#0070ba', padding: 14, borderRadius: 10, width: '100%', alignItems: 'center', marginBottom: 10 },
  confirmButtonText: { color: '#fff', fontWeight: 'bold' },
  closeButton: { padding: 10 },
  closeButtonText: { color: '#94a3b8' }
});
