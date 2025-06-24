import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

interface NavUIState {
  isSidebarOpen: boolean;
  activeTab: string;
  activeSubTab: string;
  testing: number;
}

const initialState: NavUIState = {
  isSidebarOpen: false,
  activeTab: "",
  activeSubTab: "",
  testing: 10,
};

const navSlice = createSlice({
  name: "navUIState",
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.isSidebarOpen = !state.isSidebarOpen;
    },
    setActiveTab: (state, action: PayloadAction<string>) => {
      state.activeTab = action.payload;
    },
    setActiveSubTab: (state, action: PayloadAction<string>) => {
      state.activeSubTab = action.payload;
    },    
    setTesting: (state, action: PayloadAction<{ testingNum: number }>) => {
      const { testingNum } = action.payload;
      state.testing = testingNum;
    },
    setAllNavUIState: (_, action: PayloadAction<NavUIState>) => {
      return action.payload;
    },
    resetStateNavUIState: () => initialState,
  },
});

export const {
  toggleSidebar,
  setActiveTab,
  setActiveSubTab,
  setTesting,
  setAllNavUIState,
  resetStateNavUIState,
} = navSlice.actions;
export default navSlice.reducer;
