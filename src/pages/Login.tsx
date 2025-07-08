// import { useState } from 'react';
// import { useNavigate } from 'react-router-dom';

// //redux toolkit
// import { useAppDispatch } from '../redux_toolkit/hooks';
// import { login } from '../redux_toolkit/features/general/auth';
// import { resetStateNavUIState } from '../redux_toolkit/features/general/navUIState';

// const Login = () => {
//   const [username, setUsername] = useState<string>('');
//   const [password, setPassword] = useState<string>('');
//   const dispatch = useAppDispatch();
//   const navigate = useNavigate();

//   const handleLogin = () => {
//     if (username.trim()) {
//       dispatch(login({username: username, token: "123456789"}));
//       dispatch(resetStateNavUIState());
//       navigate('/');
//     }
//   };

//   return (
//     <div className="min-h-screen min-w-screen flex items-center justify-center bg-gray-100">
//       <div className="bg-white rounded-4xl shadow-md min-w-2/5 h-96">
//         <div className='flex flex-col items-center min-h-full'>
//           <div className='bg-[#302c3c] h-32 w-full rounded-t-4xl flex flex-row items-center justify-center'>
//               <img src="/SGVLogo.png" alt="Logo" className="flex items-center h-24 object-contain" />
//           </div>
//           <div className='space-y-1 flex pt-4 flex-col w-full min-h-full items-center bg-[#ececec] rounded-b-4xl'>
//             <div className='w-full px-12 mb-2'>
//               <div className='font-semibold mb-1'>USERNAME</div>
//               <input
//                 type="text"
//                 className="w-full p-2 mb-4 bg-white rounded-md"
//                 placeholder="Username"
//                 value={username}
//                 onChange={e => setUsername(e.target.value)}
//               />
//             </div>
//             <div className='w-full px-12 mb-2'> 
//               <div className='font-semibold mb-1'>PASSWORD</div>
//               <input
//                 type="password"
//                 className="w-full p-2 mb-4 bg-white rounded-md"
//                 placeholder="Password"
//                 value={password}
//                 onChange={e => setPassword(e.target.value)}
//               />   
//             </div>
//             <div className='min-h-full bg-[#ececec] mb-6 rounded-b-4xl'>
//               <button onClick={handleLogin} className="w-20 shadow-lg rounded-lg h-8 bg-[#ffe404] py-1 px-2 font-bold hover:bg-yellow-300 cursor-pointer">
//                 LOG IN
//               </button>
//             </div>
//           </div>          
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Login;


import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';

// redux toolkit
import { useAppDispatch } from '../redux_toolkit/hooks';
import { login } from '../redux_toolkit/features/general/auth';
import { resetStateNavUIState } from '../redux_toolkit/features/general/navUIState';

const Login = () => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);  
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

const handleLogin = async () => {
  // try {
  //   const response = await invoke<{
  //     success: boolean;
  //     role: string | null;
  //     message: string;
  //   }>('login', {
  //     payload: { 
  //       username: username,
  //       password: password 
  //     }
  //   });
  //   console.log('response: ', response)
  //   if (response.success) {
  //     dispatch(login({ 
  //       username: username, 
  //       token: "secret",
  //       role: response.role || "user"
  //     }));
  //     dispatch(resetStateNavUIState());
  //     navigate('/');
  //   } else {
  //     setError(response.message);
  //   }
  // } catch (err) {
  //   setError('An error occurred during login');
  //   console.error(err);
  // }

  dispatch(login({ 
    username: username, 
    token: "secret",
    role: "admin"
  }));
  navigate('/');
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-login-gradient ">
      <div className="bg-white shadow-2xl rounded-3xl w-full max-w-md px-10 py-8">
        <div className="flex flex-col items-center">
          <img src="/SGVLogoLight.png" alt="Logo" className="h-20 mb-6" />
          <h2 className="text-2xl font-bold text-gray-600 mb-8">ECL Automation</h2>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Username</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="Enter your username"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-[#cc6ff1]/90 cursor-pointer text-white font-bold py-2 rounded-md transition duration-200"
          >
            Log In
          </button>
          {error && <p className="text-red-500 mb-4 text-center">{error}</p>}          
        </div>
      </div>
    </div>
  );
};

export default Login;
