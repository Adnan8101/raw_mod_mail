const prism = require('prism-media');
console.log('prism.opus:', prism.opus);
try {
    console.log('OpusHead:', new prism.opus.OpusHead({ channelCount: 2, sampleRate: 48000 }));
} catch (e) {
    console.error('Error creating OpusHead:', e.message);
}
