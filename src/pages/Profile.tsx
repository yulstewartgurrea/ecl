import { useAppSelector } from '../redux_toolkit/hooks';

const Profile = () => {
  const username = useAppSelector(state => state.auth.username);

  return (
    <div className='mt-1 p-4'>
      <h2 className="text-2xl font-bold mb-4">Hi, {username}</h2>
      <p className="text-lg">What would you like to do today?</p>
    </div>
  );
};

export default Profile;
