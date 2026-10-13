//components
import FileExplorer from "../../../components/transition_matrix_components/FileExplorer";
import { TmInputFilesAbout } from "../../../components/about/TransitionMatrixAbout";

const Step1 = () => {

  return (  
    <div className="mt-4 space-y-4">
        <TmInputFilesAbout />
        <FileExplorer/>
    </div>
  );
};

export default Step1;
