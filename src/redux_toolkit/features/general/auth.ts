import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  isLoggedIn: boolean
  token: string | null
  username: string
}

const initialState: AuthState = {
  isLoggedIn: false,
  token: null,
  username: ""
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (state, action: PayloadAction<{ username: string, token: string }>) => {
      const { username, token } = action.payload;
      state.isLoggedIn = true;
      state.token = token;
      state.username =username;
    },
    logout: (state) => {
      state.isLoggedIn = false
      state.token = null
    },
    setAllAuthData: (_, action: PayloadAction<AuthState>) => {
      return action.payload
    },
    resetStateAuth: () => initialState,
  },
})

export const { login, logout, setAllAuthData, resetStateAuth } = authSlice.actions
export default authSlice.reducer
