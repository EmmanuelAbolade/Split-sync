// src/stores/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { signOut } from 'firebase/auth'; 
import { auth } from '../services/firebase'; 

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

      // Update user's displayName in store
      updateUserDisplayName: (displayName) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: {
              ...currentUser,
              displayName: displayName
            }
          });
        }
      },

      logout: async () => {
        try {
          // Clear state first
          set({ 
            user: null, 
            isAuthenticated: false,
            loading: false
          });
          
          // Sign out from Firebase
          await signOut(auth);
          
          // Clear all storage
          localStorage.removeItem('auth-storage'); // Clear persisted Zustand state
          sessionStorage.clear();
          
          // Clear service worker caches
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
          }
          
          // Force redirect to login (prevents back button)
          window.location.href = '/login';
          
        } catch (error) {
          console.error('Logout error:', error);
          // Still redirect even if error
          window.location.href = '/login';
        }
      },

      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'auth-storage', // localStorage key
    }
  )
);