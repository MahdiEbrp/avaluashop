import { randomInt as secureRandomInt } from 'node:crypto'

export const randomInt = (min: number, max: number) => secureRandomInt(min, max + 1)

export const randomPick = <T>(list: readonly T[]): T => list[secureRandomInt(list.length)]
