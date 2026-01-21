import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './index.css'



function App() {
  const [count, setCount] = useState(0)

  return (
   <div className="h-screen  bg-red-800  flex items-center justify-center">
      <h1 className='text-4xl font-bold'>This is the initial project setup, Tailwind CSS is working! All Directories ready</h1>
    </div>
  )
}

export default App
