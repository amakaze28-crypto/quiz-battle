import { useState } from 'react';
import { Panel, Btn } from './Ui';

export const CONTACT_EMAIL = 'kangomosibatoru@gmail.com';
export const TERMS_VERSION = '2026-11-10-v2';
const KEY = 'terms-agreed-version';
export const hasAgreed = () => { try { return localStorage.getItem(KEY) === TERMS_VERSION; } catch { return false; } };
export const saveAgreed = () => { try { localStorage.setItem(KEY, TERMS_VERSION); } catch { /* 保存できなくても続行 */ } };

// 利用規約（運営者提供の文面）。変更したら TERMS_VERSION を更新すると、全員に再度同意を求めます
export const TERMS = [
  { title: '前文', body: ["本規約は、「看護模試バトル」（以下「本サービス」）の利用条件および個人情報の取扱いについて定めるものです。ユーザーは、本サービスを利用する前に本規約に同意するものとします。"] },
  {"title": "第1条　規約の変更", "body": ["運営者（以下「当方」）は、当方の判断により、ユーザーに事前の通知なく本規約をいつでも変更できるものとします。変更後の規約は、本サービス内に掲示した時点で効力を生じ、ユーザーがその後も継続してプレイした場合は、変更後の規約に同意したものとみなします。"]},
  {"title": "第2条　アカウント管理", "body": ["ユーザーは、自己のGoogleアカウントを使用して本サービスを利用（データの引き継ぎ等）するものとします。", "ユーザーの端末の紛失、Googleアカウントの消失、第三者による不正利用等によって生じた損害について、当方は一切の責任を負いません。アカウントの譲渡や貸与・売買は禁止します。"]},
  {"title": "第3条　ゲーム内通貨およびアイテム等", "body": ["本サービス内で取得する「コイン」「魔法の砂」、ガチャから排出されるアイテム等のデジタルコンテンツ（以下「アイテム等」）は、本サービス内でのみ利用できる利用権を付与するものであり、所有権は移転しません。", "当方は、理由の如何を問わず、アイテム等の現金への払い戻し、返金、および現実の価値への交換は一切行いません。", "当方が本サービスの提供を終了する場合、すべてのアイテム等は失効するものとします。"]},
  {"title": "第4条　禁止事項", "body": ["ユーザーは、以下の行為を行ってはなりません。該当すると当方が判断した場合、次条の措置をとります。", "チート、不正ツール、プログラムの改ざん、バグの意図的な悪用", "アカウントの売買（リアルマネートレード）", "他のユーザーを不快にさせる名前の設定、嫌がらせ、虚偽の通報", "本サービス内の問題、画像、音楽等の無断転載・公開", "サーバーに過度な負担をかける行為", "その他、当方が不適切と判断する行為"]},
  {"title": "第5条　利用停止等の措置", "body": ["当方は、ユーザーが前条の禁止事項に該当した場合、または当方が必要と判断した場合、事前の通知や理由の説明なく、以下の措置をとることができるものとします。", "・アカウントの利用停止（BAN）", "・プレイデータ、アイテム等、所持通貨の没収または初期化", "・不適切なユーザー名の強制変更", "本条の措置によりユーザーに損害が生じた場合でも、当方は一切の責任を負いません。"]},
  {"title": "第6条　サービスの変更、中断、終了", "body": ["当方は、当方の都合により、事前の予告なく本サービスの内容（ガチャの排出率、アイテムの価格、問題内容などを含む）の変更、サーバーメンテナンス等による一時中断、または本サービスの提供そのものを終了することができます。これにより生じた損害について、当方は一切補償しません。"]},
  {"title": "第7条　免責事項：重要", "body": ["問題の正確性等：本サービスは学習の補助を目的としていますが、出題される問題、解答、解説の完全な正確性、最新性、および実際の看護師国家試験等における合格を保証するものではありません。本サービスの内容によってユーザーに生じた不利益（試験の不合格等）について、当方は一切の責任を負いません。", "システム上の免責：本サービスは「現状有姿」で提供されます。通信障害による誤答（お手つき）判定、bot（コンピュータ）とのマッチングによるレート変動、予期せぬバグやサーバーダウン等について、当方は補償の義務を負いません。", "ユーザー間でのトラブルが発生した場合、ユーザーの責任と費用において解決するものとし、当方は介入しません。"]},
  {"title": "第8条　権利の帰属", "body": ["本サービスに関するすべてのプログラム、デザイン、アイテム画像、出題される問題のテキスト、BGM、効果音等の知的財産権および著作権は、当方または正当な権利を有する第三者に帰属します。"]},
  {"title": "第9条　個人情報の取扱い", "body": ["当方は、本サービスの提供、運営、ユーザーサポート、および不正利用の監視（通報対応等）を目的として、Googleアカウント情報（UID等）およびプレイデータを取得・利用します。", "取得した情報は、法令に基づく場合を除き、ユーザーの同意なく第三者に提供することはありません。"]},
  {"title": "第10条　準拠法および管轄裁判所", "body": ["本規約は日本法を準拠法とし、本サービスに関して紛争が生じた場合は、当方の所在地を管轄する裁判所を専属的合意管轄とします。"]},
  {"title": "お問い合わせ先", "body": ["kangomosibatoru@gmail.com"]},
];

function Docs() {
  return (
    <div className="space-y-1.5">
      {TERMS.map((t, i) => (
        <details key={t.title} className="rounded-lg bg-black/25 px-3 py-2" open={i === 0}>
          <summary className="cursor-pointer font-bold text-[#f6e4b0] text-sm">{t.title}</summary>
          <div className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-slate-100">
            {t.body.map((b) => (b === CONTACT_EMAIL
              ? <p key={b}><a className="underline text-sky-300 break-all" href={`mailto:${CONTACT_EMAIL}`}>{b}</a></p>
              : <p key={b}>{b}</p>))}
          </div>
        </details>
      ))}
      <p className="text-xs text-slate-400 pt-1">制定日・最終更新日：{TERMS_VERSION.slice(0, 10).replace(/-/g, '/')}</p>
    </div>
  );
}

// mode='consent': ログイン前の同意確認 / mode='view': 閲覧のみ
export default function Terms({ mode = 'view', onAgree, onClose }) {
  const [ok, setOk] = useState(false);
  const consent = mode === 'consent';
  return (
    <div className="fixed inset-0 z-[60] bg-black/75 grid place-items-center p-3" onClick={consent ? undefined : onClose}>
      <Panel className="w-full max-w-lg max-h-[92dvh] flex flex-col p-4 ui-text" onClick={(e) => e.stopPropagation()}>
        <h2 className="ui-title text-xl text-center mb-1">利用規約・プライバシーポリシー</h2>
        {consent && <p className="text-xs text-center text-slate-300 mb-2">ログインの前に、内容をお読みいただき、同意をお願いします。</p>}
        <div className="overflow-y-auto min-h-0 flex-1 pr-1"><Docs /></div>
        <p className="text-xs text-slate-300 mt-2">お問い合わせ：<a className="underline text-sky-300 break-all" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        {consent ? (
          <>
            <label className="flex items-start gap-2 text-sm mt-2 cursor-pointer">
              <input type="checkbox" className="mt-1 w-4 h-4" checked={ok} onChange={(e) => setOk(e.target.checked)} />
              <span>上記の利用規約とプライバシーポリシーのすべてに同意します</span>
            </label>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Btn variant="dark" onClick={onClose}>同意しない</Btn>
              <Btn variant="gold" disabled={!ok} className="disabled:opacity-40" onClick={() => { saveAgreed(); onAgree(); }}>同意してログイン</Btn>
            </div>
          </>
        ) : <Btn variant="gold" block className="mt-3" onClick={onClose}>とじる</Btn>}
      </Panel>
    </div>
  );
}
