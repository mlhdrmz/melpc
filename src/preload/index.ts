import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type MelpcApi } from '../shared/api'

// Arayüzün veriye eriştiği tek kapı. Node ve Electron API'leri arayüze açılmaz.
const api: MelpcApi = {
  getCatalog: () => ipcRenderer.invoke(IPC.getCatalog),
  listBuilds: () => ipcRenderer.invoke(IPC.listBuilds),
  saveBuild: (input) => ipcRenderer.invoke(IPC.saveBuild, input),
  deleteBuild: (id) => ipcRenderer.invoke(IPC.deleteBuild, id)
}

contextBridge.exposeInMainWorld('melpc', api)
