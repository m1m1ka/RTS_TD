export function waveFile(frequency=440,seconds=.15) {
  const sampleRate=16000, count=Math.floor(seconds*sampleRate), bytes=Buffer.alloc(44+count*2);
  bytes.write("RIFF",0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write("WAVEfmt ",8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(sampleRate,24);bytes.writeUInt32LE(sampleRate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write("data",36);bytes.writeUInt32LE(count*2,40);
  for(let i=0;i<count;i++)bytes.writeInt16LE(Math.round(Math.sin(2*Math.PI*frequency*i/sampleRate)*3000*(1-i/count)),44+i*2);
  return bytes;
}
