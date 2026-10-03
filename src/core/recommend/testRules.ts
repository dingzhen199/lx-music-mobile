// Test fixture writes the real mobile blacklist store, keeping matching logic under test.
import { setDislikeInfo } from '@/store/dislikeList/action'
let rules: LX.Dislike.DislikeMusicInfo[] = []
const publish = () => {
  const names = new Set<string>(); const musicNames = new Set<string>(); const singerNames = new Set<string>()
  for (const rule of rules) {
    const name = (rule.name ?? '').replaceAll('@', '#').trim().toLowerCase()
    const singer = (rule.singer ?? '').replaceAll('@', '#').trim().toLowerCase()
    if (name && singer) names.add(`${name}@${singer}`)
    else if (name) musicNames.add(name)
    else if (singer) singerNames.add(singer)
  }
  setDislikeInfo({ names, musicNames, singerNames, rules: '' })
}
export const addDislikeInfo = (items: LX.Dislike.DislikeMusicInfo[]) => { rules.push(...items); publish() }
export const clearDislikeInfo = () => { rules = []; publish() }
