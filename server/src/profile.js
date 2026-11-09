import { rankInfo } from './rank.js';
import { getEmperorSet } from './emperors.js';
import { settings } from './settings.js';
import { badgeList, equippedBadge } from './badges.js';
import { seasonView } from './seasons.js';

export function profilePayload(u, isAdmin = false) {
  return {
    uid: u.uid, displayName: u.displayName, email: u.email,
    iconId: u.iconId || 'default', frameId: u.frameId || 'none', bannerId: u.bannerId || 'none', charId: u.charId || 'char-m', badgeId: u.badgeId || 'auto',
    pt: u.pt, mr: u.mr, isMaster: !!u.isMaster, wins: u.wins || 0, losses: u.losses || 0, games: u.games || 0,
    coins: u.coins || 0, sand: u.sand || 0, friendCode: u.friendCode, nameChanges: u.nameChanges || 0, nameSet: u.nameSet !== false,
    nameCost: u.nameSet === false || (u.nameChanges || 0) === 0 ? 0 : settings().renameCost,
    badges: badgeList(u), badgeInfo: equippedBadge(u), season: seasonView(), streak: u.streak || 0, bestStreak: u.bestStreak || 0, loginDays: u.loginDays || 0,
    isAdmin: !!isAdmin, rank: rankInfo(u, getEmperorSet()),
  };
}
