import { useParams } from 'react-router-dom';

export function Workspace() {
  const { workspaceId } = useParams();
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-xl font-semibold text-gray-900">Workspace {workspaceId}</h1>
      <p className="mt-2 text-gray-600">Notebook tree + editor coming in Phase 3.</p>
    </div>
  );
}

export default Workspace;
