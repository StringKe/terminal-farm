export interface UserState {
  gid: number
  name: string
  level: number
  gold: number
  exp: number
}

export interface OperationLimit {
  id: number
  dayTimes: number
  dayTimesLimit: number
  dayExpTimes: number
  dayExpTimesLimit: number
}
