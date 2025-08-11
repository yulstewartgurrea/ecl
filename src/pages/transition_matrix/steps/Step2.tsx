import clsx from "clsx";

//redux toolkit
import { useSelector } from "react-redux";

//components
import TabbedInterface from "../../../components/transition_matrix_components/TabbedInterface";

const Step2 = () => {
  const { isSidebarOpen } = useSelector((state: any) => state.navUIState);
  return (
    <div
      className={clsx(
        "w-full flex flex-col mt-4 min-h-[80%] max-h-[80%] space-y-12 lg:space-y-0 shadow-sm",
        {
          "col-span-7": isSidebarOpen,
          "col-span-3": !isSidebarOpen,
        }
      )}
    >
      <div
        className={clsx(
          "w-full flex flex-col bg-gray-100 p-4 border border-gray-300 rounded-lg shadow-sm",
          {
            "col-span-7": isSidebarOpen,
            "col-span-3": !isSidebarOpen,
          }
        )}
      >
        <TabbedInterface />
      </div>
    </div>
  );
};

export default Step2;
