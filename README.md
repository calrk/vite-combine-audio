# `vite-combine-audio`

> Vite support to combine audio files using ffmpeg to be used as an audio sprite file in a library like howler.

## Installation

Install by running the npm command

```
npm install vite-combine-audio
```

Then use it in your Vite configuration like this:

```
// vite.config.js
import combineAudio from 'vite-combine-audio';

export default {
  plugins: [combineAudio()],
};
```

### Considerations

- This Plugin requires Node 14.0 or higher
- This Plugin will install a version of ffmpeg which is required for the file merging

## Configuration

Below are the options that can be passed into the combineAudio function, all are optional and have default values set.
```
{
  fileRegex?: RegExp; // Regex to match audio files (default: /\.mp3$/)
  outputTypes?: string[]; // File output types (default: ['.mp3', '.webm'])
  filename?: string; // Filename for the merged audio file (default: 'merged-audio')
  tempDir?: string; // Temporary directory (default: 'temp/audio')
  outputDir?: string; // Output directory (default: 'dist/audio')
}
```

## Output
When importing audio clips in your vite project, they will be converted in to the following object structure in order to access the audio sprite timing.
```
  {
    output: String; // File path for the merged audio file
    filename: String; // Original file name of the audio clip
    startTime: Number; // The start time of the audio clip in the merged file
    duration: Number; // The duration of the audio clip
  }
```

## Use with Howler sound library
This tool was designed to be used with the [HowlerJS](https://howlerjs.com) library and can be used as shown below.
```
  // Import sound files
  import soundClip1 from '../../assets/sounds/soundClip1.mp3';
  import soundClip2 from '../../assets/sounds/soundClip2.mp3';

  // Create Howler object
  var audio = new Howl({
    src: soundClip1.output,
    sprite: {
      [soundClip1.filename]: [soundClip1.startTime, soundClip1.duration],
      [soundClip2.filename]: [soundClip2.startTime, soundClip2.duration],
    }
  });

  // Function to play the sounds
  function playSound (soundName){
    audio.play(soundName)
  }

  // Calling the play sound functions
  playSound(soundClip1.filename);
  playSound(soundClip2.filename);

```