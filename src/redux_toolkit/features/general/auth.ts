import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  isLoggedIn: boolean
  token: string | null
  username: string
  role: string
  tokenai: string | null
}

const initialState: AuthState = {
  isLoggedIn: false,
  token: null,
  username: "",
  role: "",
  tokenai: null
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (state, action: PayloadAction<{ username: string, token: string, role: string  }>) => {
      const { username, token ,role} = action.payload;
      state.isLoggedIn = true;
      state.token = token;
      state.username =username;
      state.role =role;
    },
    setTokenAi: (state, action: PayloadAction<{ tokenai: string }>) => {
      const { tokenai } = action.payload;
      state.tokenai = tokenai;
    },
    logout: (state) => {
      state.isLoggedIn = false
      state.token = null
      state.tokenai = null
    },
    setAllAuthData: (_, action: PayloadAction<AuthState>) => {
      return action.payload
    },
    resetStateAuth: () => initialState,
  },
})

export const { login, setTokenAi, logout, setAllAuthData, resetStateAuth } = authSlice.actions
export default authSlice.reducer
