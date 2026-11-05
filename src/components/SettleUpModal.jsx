// src/components/SettleUpModal.jsx
// Settle Up, in short steps (approved design, 2026-11-05):
//   payer:    How are you settling? -> Pay now -> pick an app -> open it
//                                   -> I already paid -> send to the payee to confirm
//   payee:    I received a payment (after "Confirm it's you")
// Every settlement write goes through the settlements Functions
// (src/utils/settlements.js). A payer only ever *claims* a payment; balances
// change when the payee confirms it, or when the payee records it themselves.
import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { PayPalButtons } from '@paypal/react-paypal-js';
import {
  X, ArrowLeft, ArrowUpRight, Check, ChevronRight, ChevronDown, Copy, CreditCard, Info,
  Landmark, QrCode, Smartphone, AlertCircle, Clock, ExternalLink,
} from 'lucide-react';
import { generatePayPalLink, generateRevolutLink, getAvailablePaymentMethods } from '../utils/paymentLinks';
import SepaPaymentModal from './SepaPaymentModal';
import { fetchIban } from '../utils/ibanService';
import { fetchGroupPaymentMethods } from '../utils/privateProfile';
import { recordPaymentSent } from '../stores/notificationsStore';
import useStepUp from '../hooks/useStepUp';
import useFeatureFlags from '../hooks/useFeatureFlags';
import {
  startSettlement, receiveSettlement, receiveParams, cancelSettlement, settlementErrorMessage, methodLabel,
} from '../utils/settlements';
import { newIdempotencyKey } from '../utils/stepUp';
import QRCodeCanvas from './QRCodeCanvas';
import ActionButton from './ActionButton';

const MAX_AMOUNT = 1000000;

// "How did you pay?" choices for I already paid; cash and other are 'manual' on the server
const PAID_VIA = [
  { id: 'cash', label: 'Cash', method: 'manual' },
  { id: 'bank', label: 'Bank transfer', method: 'bank' },
  { id: 'revolut', label: 'Revolut', method: 'revolut' },
  { id: 'paypal', label: 'PayPal', method: 'paypal' },
  { id: 'other', label: 'Other', method: 'manual' },
];

const CHOICE =
  'w-full flex items-center gap-4 p-4 text-left rounded-2xl border-2 border-gray-200 dark:border-gray-700 ' +
  'bg-white dark:bg-gray-800 transition duration-150 hover:border-blue-300 hover:bg-blue-50 ' +
  'dark:hover:border-blue-700 dark:hover:bg-blue-900/20 active:scale-[0.98] active:bg-blue-100 ' +
  'dark:active:bg-blue-900/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500';

function Note({ tone = 'info', children }) {
  const tones = {
    info: 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100',
    warn: 'bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:border-amber-800',
  };
  const Icon = tone === 'warn' ? AlertCircle : Info;
  return (
    <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm leading-relaxed ${tones[tone]}`}>
      <Icon size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export default function SettleUpModal({ isOpen, onClose, settlement, group, currentUserId }) {
  const [step, setStep] = useState('choose'); // payer: choose | paynow | method | already
  const [amount, setAmount] = useState(settlement?.amount?.toFixed(2) || '');
  const [paidVia, setPaidVia] = useState('cash');
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { title, message }
  const [copied, setCopied] = useState(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [recipientPaymentMethods, setRecipientPaymentMethods] = useState(null);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(true);
  const [pendingPayment, setPendingPayment] = useState(null);
  const [showSepaModal, setShowSepaModal] = useState(false);
  const [sepaPaymentData, setSepaPaymentData] = useState(null);
  const [activeQR, setActiveQR] = useState('paypal');
  const [showQR, setShowQR] = useState(false);
  const [showDemoInfo, setShowDemoInfo] = useState(false);
  const { isEnabled } = useFeatureFlags();
  const paymentDemosOn = isEnabled('paymentDemosEnabled');
  const { requestStepUp, stepUpSheet } = useStepUp();

  const fromMember = group?.members?.find(m => m.userId === settlement?.from);
  const toMember = group?.members?.find(m => m.userId === settlement?.to);
  const fromName = fromMember?.name || 'them';
  const toName = toMember?.name || 'them';
  const userIsPaying = currentUserId === settlement?.from;
  const userIsReceiving = currentUserId === settlement?.to;
  const currency = group?.currency || 'EUR';
  const owed = settlement?.amount || 0;

  // One idempotency key per user intent (what, how much, how), kept while the
  // modal is open, so a retry or double tap can never record a payment twice.
  const intentKeys = useRef({});
  const keyFor = (intent) => {
    if (!intentKeys.current[intent]) intentKeys.current[intent] = newIdempotencyKey();
    return intentKeys.current[intent];
  };
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Reset on open, then follow this pair's payment lock: 'started' means the
  // payer opened a payment app ("Did you finish paying?"), 'claimed' means it
  // is waiting for the payee.
  useEffect(() => {
    if (!isOpen) return undefined;
    setStep('choose');
    setResult(null);
    setError('');
    setBusy(null);
    setCopied(null);
    setCopyFailed(false);
    setSelectedMethod(null);
    setPaidVia('cash');
    setAmount(settlement?.amount?.toFixed(2) || '');
    intentKeys.current = {};

    if (!group?.id || !settlement?.from || !settlement?.to) return undefined;
    const ref = doc(db, 'pendingPayments', `${group.id}_${settlement.from}_${settlement.to}`);
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPendingPayment(data);
        sessionStorage.setItem('pendingPayment', JSON.stringify(data));
      } else {
        setPendingPayment(null);
        sessionStorage.removeItem('pendingPayment');
      }
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [isOpen, group?.id, settlement?.from, settlement?.to, settlement?.amount]);

  // The payee's payment options (private; the server shares them with group members)
  useEffect(() => {
    if (!isOpen || !settlement?.to) return;
    let live = true;
    (async () => {
      setLoadingPaymentMethods(true);
      try {
        const all = await fetchGroupPaymentMethods(group?.id);
        const view = all[settlement.to];
        const raw = view ? { ...view } : null;
        if (raw?.hasIban) {
          const plain = await fetchIban(settlement.to, group?.id);
          if (plain) raw.iban = plain;
        }
        if (live) setRecipientPaymentMethods(raw);
      } catch (err) {
        console.error('Error fetching payment methods:', err?.code);
      } finally {
        if (live) setLoadingPaymentMethods(false);
      }
    })();
    return () => { live = false; };
  }, [settlement, isOpen, group?.id]);

  const methods = getAvailablePaymentMethods(recipientPaymentMethods) || [];
  const claimed = pendingPayment?.status === 'claimed';
  const started = !!pendingPayment && !claimed;

  /** The amount as a number, or null with an error shown. */
  const readAmount = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) { setError('Enter an amount above zero.'); return null; }
    if (n > MAX_AMOUNT) { setError('The amount cannot be more than 1,000,000.'); return null; }
    return n;
  };

  const onAmountChange = (value) => {
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmount(value);
      if (error) setError('');
    }
  };

  const copyText = (text, key) => {
    setCopyFailed(false);
    if (!navigator.clipboard?.writeText) { setCopyFailed(true); return; }
    navigator.clipboard.writeText(text).then(
      () => { setCopied(key); later(() => setCopied(c => (c === key ? null : c)), 2500); },
      () => setCopyFailed(true),
    );
  };

  const finish = (title, message) => {
    setResult({ title, message });
    later(() => onClose(), 3000);
  };

  // Payer: tell the payee we paid. Nothing changes until they confirm.
  const claimPayment = async (method, amountNum, paypalOrderId = null) => {
    await recordPaymentSent({
      payeeId: settlement.to,
      groupId: group.id,
      amount: amountNum,
      method,
      idempotencyKey: keyFor(`claim:${method}:${amountNum.toFixed(2)}`),
      ...(paypalOrderId ? { paypalOrderId } : {}),
    });
  };

  const sendClaim = async (method, amountNum, busyKey = 'claim') => {
    setBusy(busyKey);
    setError('');
    try {
      await claimPayment(method, amountNum);
      sessionStorage.removeItem('pendingPayment');
      finish(`Sent to ${toName}`,
        `${currency} ${amountNum.toFixed(2)} by ${methodLabel(method)}. Your balance updates when ${toName} confirms. You can withdraw it until then.`);
    } catch (err) {
      setError(settlementErrorMessage(err, 'That did not work. Nothing was saved, please try again.'));
    } finally {
      setBusy(null);
    }
  };

  // "I already paid"
  const handleAlreadyPaid = (e) => {
    e.preventDefault();
    const n = readAmount();
    if (n === null) return;
    const via = PAID_VIA.find(p => p.id === paidVia) || PAID_VIA[0];
    sendClaim(via.method, n);
  };

  // "Did you finish paying?" -> Yes, I paid
  const handleFinishedPaying = () => {
    if (!pendingPayment) return;
    sendClaim(pendingPayment.method || 'manual', Number(pendingPayment.amount), 'yes');
  };

  // "Did you finish paying?" -> Not yet, or Withdraw on a claim
  const handleCancelPending = async (busyKey) => {
    setBusy(busyKey);
    setError('');
    try {
      await cancelSettlement({ groupId: group.id, toUid: settlement.to });
      sessionStorage.removeItem('pendingPayment');
      setPendingPayment(null);
      if (busyKey === 'withdraw') {
        setResult({ title: 'Payment withdrawn', message: `${toName} was told. Nothing was recorded.` });
      } else {
        setResult({ title: 'Nothing was recorded', message: 'Settle up again when you are ready.' });
      }
      later(() => onClose(), 3000);
    } catch (err) {
      setError(settlementErrorMessage(err, 'That did not work. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  // Pay now -> open the app. window.open runs first, inside the tap, so
  // browsers do not block it; the server then remembers the started payment.
  const openPaymentApp = (method) => {
    const n = readAmount();
    if (n === null) return;
    const link = method.id === 'paypal'
      ? generatePayPalLink(method.username, n, currency)
      : generateRevolutLink(method.username, n, currency);
    navigator.clipboard?.writeText(n.toFixed(2)).catch(() => {});
    window.open(link, '_blank');
    const data = {
      groupId: group.id, fromUserId: settlement.from, toUserId: settlement.to,
      fromName, toName, amount: n, currency, method: method.id, timestamp: Date.now(),
    };
    sessionStorage.setItem('pendingPayment', JSON.stringify(data));
    startSettlement({ groupId: group.id, toUid: settlement.to, amount: n, method: method.id })
      .catch(err => console.error('Failed to save started payment:', err?.code));
    onClose();
  };

  // Payee: record a payment received. Balances change, so "Confirm it's you" first.
  const handleReceived = async (e) => {
    e.preventDefault();
    const n = readAmount();
    if (n === null) return;
    setBusy('receive');
    setError('');
    try {
      const params = {
        groupId: group.id,
        fromUid: settlement.from,
        amount: n,
        idempotencyKey: keyFor(`receive:${n.toFixed(2)}`),
      };
      const token = await requestStepUp('settlements.receive', receiveParams(params));
      if (!token) { setError('Not recorded: confirming it is you was cancelled.'); return; }
      await receiveSettlement(params, token);
      finish('Payment recorded', `${currency} ${n.toFixed(2)} from ${fromName} is settled. ${fromName} was told.`);
    } catch (err) {
      setError(settlementErrorMessage(err, 'That did not work. Nothing was saved, please try again.'));
    } finally {
      setBusy(null);
    }
  };

  // ---- PayPal sandbox and SEPA simulation (demo switch) ----
  const handleSepaPayment = () => {
    setSepaPaymentData({
      amount: parseFloat(amount),
      fromUser: { id: settlement.from, name: fromName },
      toUser: { id: settlement.to, name: toName },
      fromUserPaymentMethods: null,
      toUserPaymentMethods: recipientPaymentMethods,
      groupName: group.name,
      groupId: group.id,
    });
    setShowSepaModal(true);
  };

  // The simulation moves no money, so it is a claim like any other payment.
  const handleSepaPaymentSuccess = async (paymentResult) => {
    setShowSepaModal(false);
    await sendClaim('sepa', Number(paymentResult.amount));
  };

  const createPayPalOrder = (data, actions) => {
    const n = readAmount();
    if (n === null) return undefined;
    return actions.order.create({
      purchase_units: [{
        description: `Settlement: ${fromName} pays ${toName}`,
        amount: { currency_code: currency, value: n.toFixed(2) },
      }],
      application_context: { shipping_preference: 'NO_SHIPPING' },
    });
  };

  const onPayPalApprove = async (data) => {
    setBusy('claim');
    setError('');
    try {
      const capturePayPal = httpsCallable(getFunctions(), 'capturePayPalOrder');
      const res = await capturePayPal({ orderId: data.orderID });
      if (!res.data.success) throw new Error('capture failed');
      const n = parseFloat(amount);
      await claimPayment('paypal', n, res.data.orderId);
      finish(`Sent to ${toName}`, `${currency} ${n.toFixed(2)} by PayPal (demo). Your balance updates when ${toName} confirms.`);
    } catch (err) {
      console.error('PayPal error:', err?.code);
      setError('Payment failed. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const onPayPalError = (err) => {
    console.error('PayPal error:', err?.code);
    setError('Payment initialization failed. Please try again.');
  };

  if (!isOpen) return null;

  // ---- layout pieces ----
  const shell = (title, { onBack, subtitle } = {}, body) => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-gray-50 dark:bg-gray-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-card-3d dark:shadow-gray-900/50"
      >
        <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          {onBack ? (
            <button type="button" onClick={onBack} aria-label="Back" className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 active:scale-95 transition">
              <ArrowLeft size={22} />
            </button>
          ) : null}
          <div className="flex-1 min-w-0 px-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{title}</h2>
            {subtitle ? <p className="text-[13px] text-gray-600 dark:text-gray-400">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 active:scale-95 transition">
            <X size={22} />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          {error ? (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-800 dark:text-red-200">
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}
          {body}
        </div>
      </div>
      {stepUpSheet}
      {showSepaModal && sepaPaymentData && (
        <SepaPaymentModal
          isOpen={showSepaModal}
          onClose={() => setShowSepaModal(false)}
          payment={sepaPaymentData}
          currentUser={{ uid: currentUserId }}
          onPaymentSuccess={handleSepaPaymentSuccess}
        />
      )}
    </div>
  );

  const amountField = (id, label, hint) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</label>
      <div className="flex items-center gap-2 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 focus-within:border-blue-500">
        <span className="text-xl font-semibold text-gray-600 dark:text-gray-400">{currency}</span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          onBlur={(e) => { const v = parseFloat(e.target.value); if (v > 0) setAmount(v.toFixed(2)); }}
          placeholder="0.00"
          className="w-full bg-transparent py-3 text-2xl font-bold text-gray-900 dark:text-white outline-none"
        />
      </div>
      {hint ? <p className="text-[13px] text-gray-600 dark:text-gray-400">{hint}</p> : null}
    </div>
  );

  const copyButton = (text, key, label) => (
    copied === key ? (
      <button type="button" aria-live="polite" className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border-2 border-green-600 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 font-semibold">
        <Check size={18} aria-hidden="true" /> Copied {key === 'amount' ? text : ''}
      </button>
    ) : (
      <button type="button" onClick={() => copyText(text, key)} className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-200 active:scale-[0.97] transition">
        <Copy size={18} aria-hidden="true" /> {label}
      </button>
    )
  );

  const debtCard = (who, line) => (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="w-12 h-12 flex-shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center text-lg font-bold">
        {(who || '?').charAt(0).toUpperCase()}
      </div>
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{line}</p>
        <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{currency} {owed.toFixed(2)}</p>
      </div>
    </div>
  );

  // ---- result (after any action) ----
  if (result) {
    return shell(result.title, {}, (
      <div className="flex flex-col items-center gap-3 py-6 text-center" role="status" aria-live="polite">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 flex items-center justify-center">
          <Check size={34} aria-hidden="true" />
        </div>
        <p className="text-xl font-bold text-gray-900 dark:text-white">{result.title}</p>
        <p className="text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">{result.message}</p>
        <ActionButton className="w-full mt-2" onClick={onClose}>Done</ActionButton>
      </div>
    ));
  }

  // ---- payee ----
  if (userIsReceiving) {
    const hasQr = recipientPaymentMethods?.paypalUsername || recipientPaymentMethods?.revolutUsername;
    return shell('Settle up', {}, (
      <form onSubmit={handleReceived} className="flex flex-col gap-4">
        {debtCard(fromName, `${fromName} owes you in ${group?.name || 'this group'}`)}
        {amountField('received-amount', `How much did ${fromName} pay you?`, `${fromName} owes ${currency} ${owed.toFixed(2)}.`)}

        <button
          type="button"
          onClick={() => setShowQR(p => !p)}
          aria-expanded={showQR}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 active:scale-[0.98] transition"
        >
          <span className="flex items-center gap-3 text-left">
            <QrCode size={20} className="text-indigo-700 dark:text-indigo-300" aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold text-indigo-900 dark:text-indigo-100">Let {fromName} scan to pay you</span>
              <span className="block text-[13px] text-indigo-700 dark:text-indigo-300">{showQR ? 'Tap to hide' : 'Show a PayPal or Revolut QR code'}</span>
            </span>
          </span>
          <ChevronDown size={18} className={`text-indigo-600 transition-transform ${showQR ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {showQR && (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 p-4 flex flex-col items-center gap-3">
            {hasQr ? (
              <>
                <div className="flex gap-2 w-full">
                  {recipientPaymentMethods.paypalUsername && (
                    <button type="button" onClick={() => setActiveQR('paypal')} className={`flex-1 min-h-[40px] rounded-lg text-sm font-semibold transition active:scale-[0.97] ${activeQR === 'paypal' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>PayPal</button>
                  )}
                  {recipientPaymentMethods.revolutUsername && (
                    <button type="button" onClick={() => setActiveQR('revolut')} className={`flex-1 min-h-[40px] rounded-lg text-sm font-semibold transition active:scale-[0.97] ${activeQR === 'revolut' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>Revolut</button>
                  )}
                </div>
                {recipientPaymentMethods.paypalUsername && (activeQR === 'paypal' || !recipientPaymentMethods.revolutUsername) && (
                  <>
                    <QRCodeCanvas value={generatePayPalLink(recipientPaymentMethods.paypalUsername, parseFloat(amount) || owed, currency)} size={200} />
                    <p className="text-sm text-gray-700 dark:text-gray-300">Opens PayPal with {currency} {(parseFloat(amount) || owed).toFixed(2)} filled in</p>
                  </>
                )}
                {recipientPaymentMethods.revolutUsername && (activeQR === 'revolut' || !recipientPaymentMethods.paypalUsername) && (
                  <>
                    <QRCodeCanvas value={generateRevolutLink(recipientPaymentMethods.revolutUsername, parseFloat(amount) || owed, currency)} size={200} />
                    <p className="text-sm text-gray-700 dark:text-gray-300">Opens Revolut. {fromName} enters {currency} {(parseFloat(amount) || owed).toFixed(2)}.</p>
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">Add your PayPal or Revolut username in your Profile to show a QR code here.</p>
            )}
          </div>
        )}

        <Note>You will be asked to confirm it is you. Then {fromName}&apos;s balance updates straight away.</Note>
        <ActionButton type="submit" variant="success" className="w-full" busy={busy === 'receive'} busyLabel="Recording payment…">
          <Check size={18} aria-hidden="true" /> I received a payment
        </ActionButton>
      </form>
    ));
  }

  if (!userIsPaying) return null;

  // ---- payer: "Did you finish paying?" for a payment app they opened ----
  if (started) {
    return shell(`Did you finish paying ${toName}?`, {}, (
      <>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You opened {methodLabel(pendingPayment.method)}
            {pendingPayment.timestamp ? ` at ${new Date(pendingPayment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}.
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{pendingPayment.currency || currency} {Number(pendingPayment.amount).toFixed(2)}</p>
        </div>
        <Note>Say yes only if the money has gone. {toName} confirms before your balance changes.</Note>
        <div className="flex gap-3">
          <ActionButton className="flex-1" onClick={handleFinishedPaying} busy={busy === 'yes'} busyLabel="Sending…" disabled={!!busy}>Yes, I paid</ActionButton>
          <ActionButton variant="secondary" className="flex-1" onClick={() => handleCancelPending('notyet')} busy={busy === 'notyet'} busyLabel="Saving…" disabled={!!busy}>Not yet</ActionButton>
        </div>
      </>
    ));
  }

  // ---- payer: pick an app (step 2 of 2) ----
  if (step === 'method' && selectedMethod) {
    const n = parseFloat(amount) || 0;
    const fixed = n.toFixed(2);
    const back = { onBack: () => { setStep('paynow'); setError(''); }, subtitle: 'Step 2 of 2' };

    if (selectedMethod.id === 'bank') {
      return shell(`Pay ${toName} by bank transfer`, back, (
        <>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex flex-col gap-4 text-sm">
            <div>
              <p className="font-semibold text-gray-600 dark:text-gray-400">Name</p>
              <p className="text-gray-900 dark:text-white">{toName}</p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-semibold text-gray-600 dark:text-gray-400">IBAN</p>
              <p className="font-mono break-all rounded-lg bg-gray-100 dark:bg-gray-700 p-2 text-gray-900 dark:text-white">{selectedMethod.iban}</p>
              {copyButton(selectedMethod.iban, 'iban', 'Copy IBAN')}
            </div>
            {selectedMethod.bic ? (
              <div>
                <p className="font-semibold text-gray-600 dark:text-gray-400">BIC</p>
                <p className="font-mono text-gray-900 dark:text-white">{selectedMethod.bic}</p>
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <p className="font-semibold text-gray-600 dark:text-gray-400">Amount</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{currency} {fixed}</p>
              {copyButton(fixed, 'amount', 'Copy amount')}
            </div>
            <div>
              <p className="font-semibold text-gray-600 dark:text-gray-400">Reference</p>
              <p className="text-gray-900 dark:text-white">SplitSync Settlement</p>
            </div>
          </div>
          {copyFailed ? <Note tone="warn">Copying is not available here. Type the details into your banking app.</Note> : null}
          <Note>Send it from your banking app, then come back and tap below.</Note>
          <ActionButton className="w-full" onClick={() => sendClaim('bank', n)} busy={busy === 'claim'} busyLabel={`Sending to ${toName}…`}>
            I have sent it
          </ActionButton>
        </>
      ));
    }

    const isRevolut = selectedMethod.id === 'revolut';
    const appName = isRevolut ? 'Revolut' : 'PayPal';
    return shell(`Pay ${toName} with ${appName}`, back, (
      <>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 flex flex-col items-center gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">Amount to send to @{(selectedMethod.username || '').replace('@', '')}</p>
          <p className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">{currency} {fixed}</p>
          {copyButton(fixed, 'amount', 'Copy amount')}
        </div>
        {copyFailed ? <Note tone="warn">Copying is not available here. Remember {currency} {fixed}.</Note> : null}
        {isRevolut
          ? <Note tone="warn">Revolut cannot fill in the amount for you. Paste it when the app opens.</Note>
          : <Note>PayPal fills in the amount for you.</Note>}
        <ActionButton className="w-full min-h-[52px]" onClick={() => openPaymentApp(selectedMethod)}>
          Open {appName} <ExternalLink size={18} aria-hidden="true" />
        </ActionButton>
        <p className="-mt-2 text-center text-[13px] text-gray-600 dark:text-gray-400">
          Opening also copies the amount. When you come back, we ask if you finished paying.
        </p>
        {isRevolut ? (
          <div className="flex items-center gap-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex-shrink-0 rounded-lg bg-white p-1">
              <QRCodeCanvas value={generateRevolutLink(selectedMethod.username, n, currency)} size={96} />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-gray-900 dark:text-white">On a laptop?</p>
              <p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-400">Revolut works best on your phone. Scan this with your phone camera to open it there.</p>
            </div>
          </div>
        ) : null}
      </>
    ));
  }

  // ---- payer: Pay now (step 1 of 2) ----
  if (step === 'paynow') {
    return shell('Pay now', { onBack: () => { setStep('choose'); setError(''); }, subtitle: 'Step 1 of 2' }, (
      <>
        {amountField('pay-amount', `Amount to pay ${toName}`, `You owe ${currency} ${owed.toFixed(2)}. You can pay part of it.`)}
        <h3 className="mt-1 text-base font-bold text-gray-900 dark:text-white">Pay {toName} with</h3>
        {loadingPaymentMethods ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading {toName}&apos;s payment options…</p>
        ) : methods.length === 0 ? (
          <Note tone="warn">{toName} has not added PayPal, Revolut or bank details yet. Pay another way, then use I already paid.</Note>
        ) : (
          methods.map((m) => (
            <button
              key={m.id}
              type="button"
              className={CHOICE}
              onClick={() => { if (readAmount() !== null) { setSelectedMethod(m); setStep('method'); setCopied(null); } }}
            >
              <span className={`w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center ${m.id === 'bank' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : m.id === 'paypal' ? 'bg-blue-800 text-white' : 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'}`}>
                {m.id === 'bank' ? <Landmark size={22} aria-hidden="true" /> : m.id === 'paypal' ? <CreditCard size={22} aria-hidden="true" /> : <Smartphone size={22} aria-hidden="true" />}
              </span>
              <span className="flex-1">
                <span className="block text-base font-semibold text-gray-900 dark:text-white">{m.id === 'bank' ? 'Bank transfer' : m.name}</span>
                <span className="block text-[13px] text-gray-600 dark:text-gray-400">
                  {m.id === 'bank' ? 'Copy IBAN and amount to your banking app'
                    : m.id === 'paypal' ? `@${m.username} · amount filled in for you`
                      : `@${m.username} · you paste the amount`}
                </span>
              </span>
              <ChevronRight size={20} className="text-gray-500" aria-hidden="true" />
            </button>
          ))
        )}
        <p className="text-[13px] text-gray-600 dark:text-gray-400">Only the ways {toName} has set up are shown.</p>

        {paymentDemosOn && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowDemoInfo(p => !p)}
              aria-expanded={showDemoInfo}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 active:scale-[0.98] transition"
            >
              <span className="text-left">
                <span className="block text-sm font-bold text-yellow-900 dark:text-yellow-200">Future feature - Settlement Payment Flow</span>
                <span className="block text-xs text-yellow-800 dark:text-yellow-300">{showDemoInfo ? 'Tap to collapse' : 'PayPal sandbox and SEPA simulation demos'}</span>
              </span>
              <ChevronDown size={18} className={`text-yellow-700 transition-transform ${showDemoInfo ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {showDemoInfo && (
              <div className="mt-2 rounded-xl border border-yellow-200 dark:border-yellow-800 bg-white dark:bg-gray-800 p-4 flex flex-col gap-4">
                <p className="text-xs text-yellow-900 dark:text-yellow-200"><strong>Demo Mode:</strong> These demos use sandbox environments. No real money is transferred.</p>
                {parseFloat(amount) > 0 ? (
                  <PayPalButtons
                    style={{ layout: 'vertical', label: 'pay' }}
                    createOrder={createPayPalOrder}
                    onApprove={onPayPalApprove}
                    onError={onPayPalError}
                    disabled={!!busy}
                  />
                ) : (
                  <p className="text-center text-sm text-gray-600 dark:text-gray-400">Enter an amount above to continue</p>
                )}
                {(recipientPaymentMethods?.hasIban || recipientPaymentMethods?.encryptedIBAN) && (
                  <button
                    type="button"
                    onClick={handleSepaPayment}
                    disabled={!amount || parseFloat(amount) <= 0}
                    className={CHOICE}
                  >
                    <Landmark size={20} className="text-indigo-600" aria-hidden="true" />
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-gray-900 dark:text-white">SEPA Payment Demo</span>
                      <span className="block text-xs text-gray-600 dark:text-gray-400">Simulated bank-to-bank transfer, no real funds moved</span>
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </>
    ));
  }

  // ---- payer: I already paid ----
  if (step === 'already') {
    return shell(`I already paid ${toName}`, { onBack: () => { setStep('choose'); setError(''); } }, (
      <form onSubmit={handleAlreadyPaid} className="flex flex-col gap-4">
        {amountField('paid-amount', 'How much did you pay?', `You owe ${currency} ${owed.toFixed(2)}.`)}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">How did you pay?</legend>
          <div className="flex flex-wrap gap-2">
            {PAID_VIA.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={paidVia === p.id}
                onClick={() => setPaidVia(p.id)}
                className={`min-h-[44px] px-4 rounded-full border-2 text-[15px] font-semibold transition active:scale-[0.96] ${paidVia === p.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:border-blue-300'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>
        <Note>{toName} gets a request to confirm. Your balance changes once {toName} says yes.</Note>
        <ActionButton type="submit" className="w-full min-h-[52px]" busy={busy === 'claim'} busyLabel={`Sending to ${toName}…`}>
          Send to {toName} to confirm
        </ActionButton>
      </form>
    ));
  }

  // ---- payer: How are you settling? ----
  return shell('Settle up', {}, (
    <>
      {debtCard(toName, `You owe ${toName} in ${group?.name || 'this group'}`)}
      {claimed ? (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 p-4">
          <Clock size={22} className="flex-shrink-0 text-amber-800 dark:text-amber-300" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-[15px] font-semibold text-amber-900 dark:text-amber-100">Waiting for {toName} to confirm</p>
            <p className="text-[13px] text-amber-800 dark:text-amber-300">
              {pendingPayment.currency || currency} {Number(pendingPayment.amount).toFixed(2)} by {methodLabel(pendingPayment.method)}. You can send another once {toName} answers.
            </p>
          </div>
          <ActionButton variant="warning" className="min-h-[44px] px-3 text-sm" onClick={() => handleCancelPending('withdraw')} busy={busy === 'withdraw'} busyLabel="Withdrawing…">
            Withdraw
          </ActionButton>
        </div>
      ) : null}
      <h3 className="mt-1 text-xl font-bold text-gray-900 dark:text-white">How are you settling?</h3>
      <button type="button" className={CHOICE} disabled={claimed} onClick={() => { setStep('paynow'); setError(''); }}>
        <span className="w-12 h-12 flex-shrink-0 rounded-xl bg-blue-600 text-white flex items-center justify-center"><ArrowUpRight size={24} aria-hidden="true" /></span>
        <span className="flex-1">
          <span className="block text-[17px] font-semibold text-gray-900 dark:text-white">Pay now</span>
          <span className="block text-sm text-gray-600 dark:text-gray-400">Open Revolut, PayPal or your bank details with the amount ready</span>
        </span>
        <ChevronRight size={20} className="text-gray-500" aria-hidden="true" />
      </button>
      <button type="button" className={CHOICE} disabled={claimed} onClick={() => { setStep('already'); setError(''); }}>
        <span className="w-12 h-12 flex-shrink-0 rounded-xl bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 flex items-center justify-center"><Check size={24} aria-hidden="true" /></span>
        <span className="flex-1">
          <span className="block text-[17px] font-semibold text-gray-900 dark:text-white">I already paid</span>
          <span className="block text-sm text-gray-600 dark:text-gray-400">Cash, or a transfer you made outside the app</span>
        </span>
        <ChevronRight size={20} className="text-gray-500" aria-hidden="true" />
      </button>
      <Note>{toName} confirms each payment before your balances change.</Note>
    </>
  ));
}
