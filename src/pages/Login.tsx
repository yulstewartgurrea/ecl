import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

//redux toolkit
import { useAppDispatch } from '../redux_toolkit/hooks';
import { login } from '../redux_toolkit/features/general/auth';
import { resetStateNavUIState } from '../redux_toolkit/features/general/navUIState';

const Login = () => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogin = () => {
    if (username.trim()) {
      dispatch(login({username: username, token: "123456789"}));
      dispatch(resetStateNavUIState());
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen min-w-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-4xl shadow-md min-w-2/5 h-96">
        <div className='flex flex-col items-center min-h-full'>
          <div className='bg-[#302c3c] h-32 w-full rounded-t-4xl flex flex-row items-center justify-center'>
              <img src="/SGVLogo.png" alt="Logo" className="flex items-center h-24 object-contain" />
          </div>
          <div className='space-y-1 flex pt-4 flex-col w-full min-h-full items-center bg-[#ececec] rounded-b-4xl'>
            <div className='w-full px-12 mb-2'>
              <div className='font-semibold mb-1'>USERNAME</div>
              <input
                type="text"
                className="w-full p-2 mb-4 bg-white rounded-md"
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
            <div className='w-full px-12 mb-2'> 
              <div className='font-semibold mb-1'>PASSWORD</div>
              <input
                type="password"
                className="w-full p-2 mb-4 bg-white rounded-md"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />   
            </div>
            <div className='min-h-full bg-[#ececec] mb-6 rounded-b-4xl'>
              <button onClick={handleLogin} className="w-20 shadow-lg rounded-lg h-8 bg-[#ffe404] py-1 px-2 font-bold hover:bg-yellow-300 cursor-pointer">
                LOG IN
              </button>
            </div>
          </div>          
        </div>
      </div>
    </div>
  );
};

export default Login;
