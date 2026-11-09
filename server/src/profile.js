import { rankInfo } from './rank.js';
import { getEmperorSet } from './emperors.js';
import { settings } from './settings.js';

export function profilePayload(u, isAdmin = false) {
  return {
    uid: u.uid, displayName: u.displayName, email: u.email,
    iconId: u.iconId || 'default', frameId: u.frameId || 'none', bannerId: u.bannerId || 'none', charId: u.charId || 'char-m', badgeId: u.badgeId || 'auto',
    pt: u.pt, mr: u.mr, isMaster: !!u.isMaster, wins: u.wins || 0, losses: u.losses || 0, games: u.games || 0,
    coins: u.coins || 0, sand: u.sand || 0, friendCode: u.friendCode, nameChanges: u.nameChanges || 0,
    nameCost: (u.nameChanges || 0) === 0 ? 0 : settings().renameCost,
    isAdmin: !!isAdmin, rank: rankInfo(u, getEmperorSet()),
  };
}
