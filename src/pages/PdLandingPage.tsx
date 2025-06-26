import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const PdLandingPage = () => {
  const navigate = useNavigate();

  const options = [
    {
      title: 'Transition Matrix',
      description: 'Analyze transition probabilities between credit ratings.',
    },
    {
      title: 'Approach 2',
      description: 'Description for Approach 2.',
    },
    {
      title: 'Approach 3',
      description: 'Description for Approach 3.',
    },
  ];

  const handleOnCardClick = (title: string) => {
    if (title === 'Transition Matrix') {
      navigate('/transition_matrix');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="mt-2 text-3xl font-bold text-gray-700 text-center mb-12">
          Probability of Default
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {options.map((option) => (
            <motion.div
              key={option.title}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="cursor-pointer"
              onClick={() => handleOnCardClick(option.title)}
            >
              <div className="h-full bg-white rounded-2xl shadow-lg p-6 flex flex-col justify-between">
                <h3 className="text-lg font-semibold text-gray-700">{option.title}</h3>
                <p className="text-gray-600 leading-relaxed flex-grow">{option.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PdLandingPage;
