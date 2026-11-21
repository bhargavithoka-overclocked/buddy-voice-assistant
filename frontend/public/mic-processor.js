// Runs on the audio thread and just hands raw mic samples to the main thread.
class MicProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}

registerProcessor("mic-processor", MicProcessor);
