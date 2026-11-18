import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type MelpcApi, type PriceState } from '../shared/api'

// Arayüzün veriye eriştiği tek kapı. Node ve Electron API'leri arayüze açılmaz.
const api: MelpcApi = {
  getCatalog: () => ipcRenderer.invoke(IPC.getCatalog),
  listBuilds: () => ipcRenderer.invoke(IPC.listBuilds),
  saveBuild: (input) => ipcRenderer.invoke(IPC.saveBuild, input),
  deleteBuild: (id) => ipcRenderer.invoke(IPC.deleteBuild, id),

  getPriceState: () => ipcRenderer.invoke(IPC.priceState),
  updatePrices: () => ipcRenderer.invoke(IPC.priceUpdate),
  findMatches: (partIds) => ipcRenderer.invoke(IPC.priceFindMatches, partIds),
  decideMatch: (partId, storeId, decision) => ipcRenderer.invoke(IPC.priceDecide, partId, storeId, decision),
  confirmCodeMatches: () => ipcRenderer.invoke(IPC.priceConfirmCodes),
  setMatchUrl: (partId, storeId, url) => ipcRenderer.invoke(IPC.priceSetUrl, partId, storeId, url),
  cancelPriceJob: () => ipcRenderer.invoke(IPC.priceCancel),
  getPriceHistory: (partId) => ipcRenderer.invoke(IPC.priceHistory, partId),
  readReadySystem: (url) => ipcRenderer.invoke(IPC.priceReadSystem, url),
  readHardware: () => ipcRenderer.invoke(IPC.hardwareRead),
  getLastHardware: () => ipcRenderer.invoke(IPC.hardwareLast),
  onPriceState: (listener) => {
    // Electron'un olay nesnesi arayüze geçmez; yalnızca durum verilir.
    const handler = (_e: IpcRendererEvent, state: PriceState): void => listener(state)
    ipcRenderer.on(IPC.priceChanged, handler)
    return () => {
      ipcRenderer.removeListener(IPC.priceChanged, handler)
    }
  }
}

contextBridge.exposeInMainWorld('melpc', api)
