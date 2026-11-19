export const randomInt = (min: number, max: number) =>
   Math.floor(Math.random() * (max - min + 1)) + min

export const randomPick = <T>(list: readonly T[]): T =>
   list[Math.floor(Math.random() * list.length)]
