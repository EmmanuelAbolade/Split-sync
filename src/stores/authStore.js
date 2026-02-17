// src/stores/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
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

      // Update user's photoURL in store
      updateUserPhoto: (photoURL) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: {
              ...currentUser,
              photoURL: photoURL
            }
          });
        }
      },

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