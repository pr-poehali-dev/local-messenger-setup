import { useEffect, useRef, useState, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import urls from '../../backend/func2url.json';

const API = urls as Record<string, string>;

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token') || '';
  const userId = localStorage.getItem('user_id') || '';
  return {
    'Content-Type': 'application/json',
    'X-Auth-Token': token,
    'X-User-Id': userId,
  };
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export type CallMode = 'audio' | 'video';

interface SignalPayload {
  type?: RTCSdpType;
  sdp?: string;
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  mode?: string;
}

interface Signal {
  id: number;
  type: string;
  payload: SignalPayload;
}

interface Props {
  conversationId: number;
  recipientId: number;
  recipientName: string;
  mode: CallMode;
  isIncoming?: boolean;
  incomingSignalId?: number;
  onClose: () => void;
}

export default function CallModal({
  conversationId, recipientId, recipientName, mode,
  isIncoming = false, incomingSignalId, onClose,
}: Props) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSignalIdRef = useRef<number>(incomingSignalId ? incomingSignalId - 1 : 0);

  const [status, setStatus] = useState<'calling' | 'connecting' | 'connected' | 'ended'>(
    isIncoming ? 'connecting' : 'calling'
  );
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [duration, setDuration] = useState(0);

  const sendSignal = useCallback(async (type: string, payload: object) => {
    await fetch(API.signaling, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ conversation_id: conversationId, recipient_id: recipientId, type, payload }),
    });
  }, [conversationId, recipientId]);

  const stopAll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (durationRef.current) clearInterval(durationRef.current);
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    if (pcRef.current) pcRef.current.close();
  }, []);

  const endCall = useCallback((sendHangup = true) => {
    stopAll();
    if (sendHangup) sendSignal('hangup', {}).catch(() => undefined);
    setStatus('ended');
    setTimeout(onClose, 800);
  }, [onClose, sendSignal, stopAll]);

  const handleSignal = useCallback(async (sig: Signal) => {
    const pc = pcRef.current;
    if (!pc) return;
    if (sig.type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal('answer', answer);
      setStatus('connecting');
    } else if (sig.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit));
    } else if (sig.type === 'ice') {
      await pc.addIceCandidate(new RTCIceCandidate(sig.payload as RTCIceCandidateInit)).catch(() => undefined);
    } else if (sig.type === 'hangup') {
      endCall(false);
    } else if (sig.type === 'call') {
      setStatus('connecting');
    }
  }, [sendSignal, endCall]);

  const startPoll = useCallback(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `${API.signaling}?conversation_id=${conversationId}&since=${lastSignalIdRef.current}`,
          { headers: authHeaders() }
        );
        const data = await res.json();
        if (data.signals?.length) {
          lastSignalIdRef.current = data.signals[data.signals.length - 1].id;
          for (const sig of data.signals) await handleSignal(sig);
        }
      } catch { /* ignore */ }
    }, 1000);
  }, [conversationId, handleSignal]);

  useEffect(() => {
    const init = async () => {
      const constraints = mode === 'video'
        ? { audio: true, video: { width: 640, height: 480 } }
        : { audio: true, video: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      pc.ontrack = (e) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
        setStatus('connected');
        durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) sendSignal('ice', e.candidate.toJSON());
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') endCall(false);
      };

      startPoll();

      if (!isIncoming) {
        await sendSignal('call', { mode });
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal('offer', offer);
      }
    };

    init().catch(() => { setStatus('ended'); setTimeout(onClose, 800); });

    return () => { stopAll(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMuted(m => !m);
  };

  const toggleCam = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOff(c => !c);
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const statusLabel = {
    calling: 'Вызов...',
    connecting: 'Соединение...',
    connected: fmt(duration),
    ended: 'Звонок завершён',
  }[status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {mode === 'video' && (
          <div className="relative bg-black aspect-video w-full">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <video ref={localVideoRef} autoPlay playsInline muted
              className="absolute bottom-3 right-3 w-28 h-20 rounded-xl object-cover border-2 border-white/20 bg-zinc-900" />
            {status !== 'connected' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/80">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-3">
                  <span className="text-3xl font-bold text-white">{recipientName[0]?.toUpperCase()}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="px-6 py-5 flex flex-col items-center gap-4">
          {mode === 'audio' && (
            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center">
              <span className="text-3xl font-bold text-white">{recipientName[0]?.toUpperCase()}</span>
            </div>
          )}
          <div className="text-center">
            <p className="font-semibold text-lg">{recipientName}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{statusLabel}</p>
          </div>

          <div className="flex items-center gap-3 mt-1">
            <button onClick={toggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${muted ? 'bg-red-500 text-white' : 'bg-secondary hover:bg-secondary/70'}`}
              title={muted ? 'Включить микрофон' : 'Выключить микрофон'}>
              <Icon name={muted ? 'MicOff' : 'Mic'} size={20} />
            </button>

            {mode === 'video' && (
              <button onClick={toggleCam}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${camOff ? 'bg-red-500 text-white' : 'bg-secondary hover:bg-secondary/70'}`}
                title={camOff ? 'Включить камеру' : 'Выключить камеру'}>
                <Icon name={camOff ? 'VideoOff' : 'Video'} size={20} />
              </button>
            )}

            <button onClick={() => endCall(true)}
              className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
              title="Завершить звонок">
              <Icon name="PhoneOff" size={22} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
