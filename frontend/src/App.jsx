import { Navigate, Route, Routes } from 'react-router'
import { Suspense, lazy } from 'react'
import MainLayout from './layouts/MainLayout'

const TasksPage = lazy(() => import('./pages/TasksPage'))
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'))

export default function App() {
  return (
    <Routes>
	    <Route path="/" element={<MainLayout />}>
			<Route index element={<Navigate to="/chat" replace />} />
			<Route
				path="tasks"
				element={
					<Suspense fallback={<div>A carregar...</div>}>
						<TasksPage />
					</Suspense>
				}
			/>
			<Route
				path="chat"
				element={
					<Suspense fallback={<div>A carregar...</div>}>
						<WorkspacePage />
					</Suspense>
				}
			/>
			<Route path="*" element={<Navigate to="/chat" replace />} />
	    </Route>
	  </Routes>
  )
}

