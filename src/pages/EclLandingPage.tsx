import { 
  PercentBadgeIcon,
  Square3Stack3DIcon,
  ArrowTrendingDownIcon,
  ChartPieIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

//redux toolkit
import { useAppDispatch, useAppSelector } from '../redux_toolkit/hooks';
import { setActiveTab } from '../redux_toolkit/features/general/navUIState';

const EclLandingPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const {activeTab} = useAppSelector((state)=>state.navUIState)
  const menuItems = [
    {
      title: 'Probability of Default (PD)',
      icon: PercentBadgeIcon,
    description: 'Evaluate the likelihood of a borrower defaulting on their obligations by analyzing historical data and creditworthiness indicators.'
    },
    {
      title: 'Overlay',
      icon: Square3Stack3DIcon,
    description: 'Establish key assumptions regarding market conditions, growth rates, and operational factors to inform financial projections.'
    },
    {
      title: 'Loss Given Default (LGD)',
      icon: ArrowTrendingDownIcon,
    description: 'Assess potential losses in the event of default by analyzing historical loss data and developing recovery strategies.'
    }, 
    {
      title: 'Exposure at Default (EAD)',
      icon: ChartPieIcon,
    description: 'Calculate the total value at risk in the event of a default, helping to understand the financial impact on the organization.'
    },     
     {
      title: 'Expected Credit Loss (ECL)',
      icon: ChartBarIcon,
      description: 'Calculates and monitors potential credit losses proactively, updating estimates based on current conditions and forecasts'
    },     
  ];

  const handleOnCardClick = (title: string) => {
    if (title === 'Probability of Default (PD)') {
        dispatch(setActiveTab(activeTab === title ? "" : title)); 
      navigate('/pd_landing');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="mt-2 text-3xl font-bold text-gray-700 text-center mb-12">
          Expected Credit Loss Automation
        </h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="prose prose-neutral mx-auto mb-10"
        >
          <p className='bg-white rounded-2xl shadow-md p-6'>
            Expected Credit Loss Automation (ECL Automation) is a sophisticated risk management framework designed to streamline the assessment and forecasting of credit losses. By leveraging advanced analytics and historical data, ECL Automation enables organizations to calculate expected credit losses with greater accuracy and efficiency.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                className="cursor-pointer"
                onClick={() => handleOnCardClick(item.title)}
              >
                <div className="h-full bg-white rounded-2xl shadow-lg p-6 flex flex-col justify-between">
                  <div className="flex items-center space-x-3 mb-4">
                    <Icon className="h-6 w-6 text-[#ffbe0b]" />
                    <h3 className="text-lg font-semibold text-gray-700">{item.title}</h3>
                  </div>
                  <p className="text-gray-600 leading-relaxed flex-grow">{item.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EclLandingPage;
