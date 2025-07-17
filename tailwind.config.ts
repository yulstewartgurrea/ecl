// /** @type {import('tailwindcss').Config} */
// export default {
//   content: [
//     './index.html',
//     './src/**/*.{js,ts,jsx,tsx}',
//   ],
//   theme: {
//     extend: {
//       rotate: {
//         360: '360deg',
//       },
//       keyframes: {
//         slideIn: {
//           '0%': { transform: 'translateX(-100%)' },
//           '100%': { transform: 'translateX(0)' },
//         },
//         slideOut: {
//           '0%': { transform: 'translateX(100%)' },
//           '100%': { transform: 'translateX(0%)' },
//         },
//         rotateIn: {
//           '0%': { transform: 'rotate(0deg)' },
//           '100%': { transform: 'rotate(180deg)' },
//         },
//         rotateOut: {
//           '0%': { transform: 'rotate(180deg)' },
//           '100%': { transform: 'rotate(0deg)' },
//         },
//         shimmer: {
//           '0%': { transform: 'translateX(-100%)' },
//           '100%': { transform: 'translateX(100%)' },
//         },
//         floatUpDown: {
//           '0%, 100%': { transform: 'translateY(0)' },
//           '50%': { transform: 'translateY(-30px)' },
//         },
//         floatLeftRight: {
//           '0%, 100%': { transform: 'translateX(0)' },
//           '50%': { transform: 'translateX(-30px)' },
//         },
//         rotateAndFloat: {
//           '0%, 100%': { transform: 'rotate(0) translateX(0)' },
//           '50%': { transform: 'rotate(360deg) translateX(-20px)' },
//         },
//       },
//       animation: {
//         slideIn: 'slideIn 0.5s forwards',
//         slideOut: 'slideOut 0.1s forwards',
//         rotateIn: 'rotateIn 0.5s forwards',
//         rotateOut: 'rotateOut 0.5s forwards',
//         shimmer: 'shimmer 2s infinite linear',
//         floatUpDown: 'floatUpDown 5s ease-in-out infinite',
//         floatLeftRight: 'floatLeftRight 5s ease-in-out infinite',
//         rotateAndFloat: 'rotateAndFloat 8s linear infinite',
//       },      
//     },
//   },
//   plugins: [],
// }

import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // animation: {
      //   'spin-slow': 'spin 3s linear infinite',
      //   'bounce-custom': 'bounce 1s infinite',
      // },
      // keyframes: {
      //   bounce: {
      //     '0%, 100%': { transform: 'translateY(0)' },
      //     '50%': { transform: 'translateY(-15%)' },
      //   },
      // },

      // Animation: {
      //   'spin-slow': 'spin 3s linear infinite',
      // },
      // KeyframeEffect: {
      //   bounce : {
      //     '0%, 100%': { transform: 'translateY(0)' },
      //     '50%': { transform: 'translateY(-15%)'  }    
      //   }
      // }
      
      keyframes: {
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'spin-slow': 'spin-slow 3s linear infinite',
      },      
    },
  },
  plugins: [],
}

export default config
