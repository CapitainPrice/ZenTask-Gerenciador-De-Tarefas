import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar,
  Alert
} from 'react-native';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, update } from 'firebase/database';
import { getAuth, onAuthStateChanged, signInWithGoogle } from 'firebase/auth';
import * as Notifications from 'expo-notifications';

// Configuração do Firebase (Mesma do HTML para sincronização)
const firebaseConfig = {
  apiKey: "AIzaSyAVSnWAGwNdfzM92hFSHHE1ZYx9Qa-1bdE",
  authDomain: "zentask-firebase.firebaseapp.com",
  databaseURL: "https://zentask-firebase-default-rtdb.firebaseio.com",
  projectId: "zentask-firebase",
  storageBucket: "zentask-firebase.firebasestorage.app",
  messagingSenderId: "912525998628",
  appId: "1:912525998628:web:a9be0680d953f4f2c776b1",
  measurementId: "G-4Z7JCJB6Q8"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Configuração de Notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    // Monitorar autenticação
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        // Se logado, buscar tarefas do Firebase
        const tasksRef = ref(db, `users/${user.uid}/tarefas`);
        onValue(tasksRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const taskList = Object.values(data);
            setTasks(taskList);
            scheduleNotifications(taskList);
          }
        });
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Lógica de agendamento de notificações mobile
  const scheduleNotifications = async (taskList) => {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = new Date();
    
    taskList.forEach(task => {
      if (task.concluida || !task.dataLimite) return;

      const deadline = new Date(`${task.dataLimite}T${task.horaLimite || '23:59'}`);
      const diff = deadline - now;

      const alertTimes = [
        { label: '1 dia', ms: 24 * 60 * 60 * 1000 },
        { label: '1 hora', ms: 60 * 60 * 1000 },
        { label: '10 min', ms: 10 * 60 * 1000 },
        { label: '1 min', ms: 1 * 60 * 1000 }
      ];

      alertTimes.forEach(alert => {
        const triggerTime = diff - alert.ms;
        if (triggerTime > 0) {
          Notifications.scheduleNotificationAsync({
            content: {
              title: "ZenTask Pro",
              body: `Falta ${alert.label} para: ${task.texto}`,
              data: { taskId: task.id },
            },
            trigger: { seconds: Math.floor(triggerTime / 1000) },
          });
        }
      });
    });
  };

  const toggleTask = (taskId, currentStatus) => {
    if (!user) return;
    const taskRef = ref(db, `users/${user.uid}/tarefas/${taskId}`);
    update(taskRef, { 
      concluida: !currentStatus,
      completedAt: !currentStatus ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString()
    });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.taskItem, item.concluida && styles.taskCompleted]}
      onPress={() => toggleTask(item.id, item.concluida)}
    >
      <View style={styles.checkbox}>
        {item.concluida && <Text style={styles.checkMark}>✓</Text>}
      </View>
      <View style={styles.taskContent}>
        <Text style={[styles.taskText, item.concluida && styles.textStrike]}>
          {item.texto}
        </Text>
        <Text style={styles.taskMeta}>
          {item.dataLimite} {item.horaLimite}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>ZenTask Pro</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => Alert.alert("Login", "Integre com Google Sign-In nativo")}>
          <Text style={styles.loginBtnText}>Entrar com Google</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Minhas Tarefas</Text>
        <Text style={styles.subtitle}>Sincronizado com Web</Text>
      </View>
      <FlatList
        data={tasks}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    padding: 20,
    width: '100%',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  list: {
    padding: 15,
    width: '100%',
  },
  taskItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    width: '100%',
  },
  taskCompleted: {
    opacity: 0.6,
    backgroundColor: '#f1f5f9',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkMark: {
    color: '#8b5cf6',
    fontWeight: 'bold',
  },
  taskContent: {
    flex: 1,
  },
  taskText: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '500',
  },
  textStrike: {
    textDecorationLine: 'line-through',
  },
  taskMeta: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  loginBtn: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 30,
  },
  loginBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
