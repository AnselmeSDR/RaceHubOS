import { lazy } from 'react'
import { Cpu } from 'lucide-react'
export default {routes:[{path:'',component:lazy(()=>import('./Workshop.jsx'))}],nav:[{to:'',labelKey:'nav',Icon:Cpu}]}
