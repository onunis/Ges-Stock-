import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from "@clerk/clerk-expo";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator, SafeAreaView, Platform, StatusBar } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useTheme } from '../../utils/context/themedContext';
import { useRouter } from 'expo-router';
import { logTransaction } from '../../utils/transactionLogger';
import { styles } from './styles/cadCate';

const formatCentsToCurrency = (cents: number): string => {
  if (isNaN(cents) || cents < 0) return "$0.00";
  const actualCents = Math.round(Math.max(0, cents));
  const str = String(actualCents).padStart(3, '0');
  const integerPart = str.slice(0, -2);
  const decimalPart = str.slice(-2);
  return `$${integerPart}.${decimalPart}`;
};

const parseCurrencyInputToCents = (text: string): number => {
  const cleanText = text.replace(/[^0-9]/g, '');
  if (!cleanText) return 0;
  return parseInt(cleanText, 10);
};

interface Categoria {
  id: string;
  nome: string;
  userId: string;
}

export default function CadastroCategoria() {
  const { userId, isLoaded } = useAuth();
  const router = useRouter();
  const [categoria, setCategoria] = useState('');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingCategory, setAddingCategory] = useState(false);
  const { theme } = useTheme(); 

  const CATEGORIAS_KEY = `user_${userId}_categorias`;

  const loadCategorias = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const storedCategorias = await AsyncStorage.getItem(CATEGORIAS_KEY);
      if (storedCategorias) {
        setCategorias(JSON.parse(storedCategorias));
      }
    } catch (e) {
      console.error("Erro ao carregar categorias do Async Storage:", e);
      Alert.alert("Erro", "Não foi possível carregar as categorias salvas.");
    } finally {
      setLoading(false);
    }
  }, [userId, CATEGORIAS_KEY]);

  useEffect(() => {
    if (isLoaded && userId) {
      loadCategorias();
    } else if (isLoaded && !userId) {
      setLoading(false);
      Alert.alert("Erro de Autenticação", "Você precisa estar logado para gerenciar categorias.");
    }
  }, [isLoaded, userId, loadCategorias]);

  const adicionarCategoria = async () => {
    if (!categoria.trim() || !userId) {
      Alert.alert("Erro", "Por favor, digite o nome da categoria e certifique-se de que está logado.");
      return;
    }
    setAddingCategory(true);
    try {
      const newCategoria: Categoria = {
        id: Date.now().toString(),
        nome: categoria.trim(),
        userId: userId,
      };
      const updatedCategorias = [...categorias, newCategoria];
      await AsyncStorage.setItem(CATEGORIAS_KEY, JSON.stringify(updatedCategorias));
      setCategorias(updatedCategorias);
      setCategoria('');
      Alert.alert("Sucesso", "Categoria adicionada!");

      await logTransaction(userId, 'add_category', { categoryName: newCategoria.nome });

    } catch (e) {
      console.error("Erro ao adicionar categoria no Async Storage:", e);
      Alert.alert("Erro", "Não foi possível adicionar a categoria.");
    } finally {
      setAddingCategory(false);
    }
  };

  const deletarCategoria = async (id: string, nome: string) => {
    Alert.alert(
      "Confirmar Exclusão",
      `Tem certeza que deseja excluir a categoria "${nome}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          onPress: async () => {
            if (!userId) {
              Alert.alert("Erro", "Usuário não identificado.");
              return;
            }
            try {
              const updatedCategorias = categorias.filter(cat => cat.id !== id);
              await AsyncStorage.setItem(CATEGORIAS_KEY, JSON.stringify(updatedCategorias));
              setCategorias(updatedCategorias);
              Alert.alert("Sucesso", "Categoria excluída!");

              await logTransaction(userId, 'delete_category', { categoryName: nome });

            } catch (e) {
              console.error("Erro ao deletar categoria:", e);
              Alert.alert("Erro", "Não foi possível excluir a categoria.");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.text} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Carregando categorias...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : Constants.statusBarHeight + 10, backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Cadastrar Categorias</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.formContainer}>
        <TextInput
          placeholder="Nome da categoria"
          style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.inputText }]}
          placeholderTextColor={theme.text === '#FFFFFF' ? '#aaa' : '#999'}
          value={categoria}
          onChangeText={setCategoria}
        />
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.buttonPrimaryBg }, addingCategory && styles.buttonDisabled]} onPress={adicionarCategoria} disabled={addingCategory}>
          {addingCategory ? (
            <ActivityIndicator color={theme.buttonPrimaryText} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.buttonPrimaryText }]}>Adicionar</Text>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={categorias}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={{ color: theme.text, flex: 1 }}>{item.nome}</Text>
            <TouchableOpacity onPress={() => deletarCategoria(item.id, item.nome)}>
              <MaterialIcons name="delete" size={24} color={theme.red} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={() => (
          <Text style={[styles.emptyListText, { color: theme.text }]}>Nenhuma categoria cadastrada ainda.</Text>
        )}
        contentContainerStyle={styles.flatListContentContainer}
      />
    </SafeAreaView>
  );
}

