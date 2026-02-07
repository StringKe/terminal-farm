import { EventEmitter } from 'node:events'

export interface AccountInfo {
  id: string
  platform: 'qq' | 'wx'
  code: string
  name: string
  level: number
  status: 'connecting' | 'online' | 'offline' | 'error'
}

export class AccountStore extends EventEmitter {
  private accounts: AccountInfo[] = []
  private currentIndex = 0

  getAccounts(): readonly AccountInfo[] {
    return this.accounts
  }

  getCurrentAccount(): AccountInfo | undefined {
    return this.accounts[this.currentIndex]
  }

  getCurrentIndex(): number {
    return this.currentIndex
  }

  addAccount(account: AccountInfo): void {
    this.accounts.push(account)
    this.emit('change', 'accounts')
  }

  removeAccount(id: string): void {
    this.accounts = this.accounts.filter((a) => a.id !== id)
    if (this.currentIndex >= this.accounts.length) {
      this.currentIndex = Math.max(0, this.accounts.length - 1)
    }
    this.emit('change', 'accounts')
  }

  updateAccount(id: string, partial: Partial<AccountInfo>): void {
    const account = this.accounts.find((a) => a.id === id)
    if (account) {
      Object.assign(account, partial)
      this.emit('change', 'accounts')
    }
  }

  switchTo(index: number): void {
    if (index >= 0 && index < this.accounts.length) {
      this.currentIndex = index
      this.emit('change', 'currentAccount')
    }
  }
}
