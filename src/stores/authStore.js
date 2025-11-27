// src/stores/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      // State
      user: null,
      isAuthenticated: false,
      loading: true,

      // Actions
      setUser: (user) => set({ 
        user, 
        isAuthenticated: !!user,
        loading: false 
      }),

      logout: () => set({ 
        user: null, 
        isAuthenticated: false,
        loading: false
      }),

      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'auth-storage', // localStorage key
    }
  )
);