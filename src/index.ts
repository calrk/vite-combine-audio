import { ResolvedConfig } from 'vite';
import * as fs from 'fs-extra';
import { createReadStream } from 'node:fs';
import * as path from 'path';
import { execSync } from 'child_process';
import ffmpegPath from 'ffmpeg-static'; // Import the ffmpeg-static binary
import { writeFileSync, existsSync } from 'node:fs';

type Options = {
  fileRegex?: RegExp; // Regex to match audio files (default: /\.mp3$/)
  outputTypes?: string[]; // Default output types
  filename?: string; // Default filename for the merged audio file
  tempDir?: string; // Default temporary directory
  outputDir?: string; // Default output directory
};

export default function combineAudio(options: Options = {}) {
  let config: ResolvedConfig;
  // Store paths of all .mp3 files
  const audioFiles: string[] = [];

  // Default filename for the merged audio file
  let filename = options.filename || 'merged-audio';
  // Default temporary and output directories
  let tempDir: string = options.tempDir || 'temp/audio';
  let outputDir: string = options.outputDir || 'dist/audio';

  // Cumulative current time for audio file starts
  let currentTime = 0;

  const fileRegex = options.fileRegex || /\.mp3$/;
  const outputTypes = options.outputTypes || ['.mp3', '.webm']; // Default output types

  return {
    name: 'audio-build',

    configResolved(_config: ResolvedConfig) {
      config = _config;

      tempDir = path.resolve(config.root, tempDir);
      outputDir = path.resolve(config.root, outputDir);
    },

    async transform(src, id) {
      if (fileRegex.test(id)) {

        // Collect all valid files
        audioFiles.push(id);

        let file = id;
        let dataItem: {
          output: Array<string>,
          filename: string,
          startTime: number,
          duration: number
        };

        let outputs = [];
        if(outputTypes.includes('.mp3')){
          outputs.push(path.join(tempDir, filename+'.mp3'));
        }
        if(outputTypes.includes('.webm')){
          outputs.push(path.join(tempDir, filename+'.webm'));
        }

        // Generate metadata for each file
        try {
          const sanitizedFilePath = file.replace(/\\/g, '/');

          // Log the command for debugging
          // console.log(`Running command: "${ffmpegPath}" -i "${sanitizedFilePath}"`);

          // Get the duration of the current file using ffmpeg-static
          const durationOutput = execSync(
            `"${ffmpegPath}" -i "${sanitizedFilePath}" 2>&1`,
            { encoding: 'utf-8' }
          );

          const durationMatch = durationOutput.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
          if (durationMatch) {
            const [, hours, minutes, seconds] = durationMatch;
            const duration =
              parseInt(hours) * 3600 * 1000 + // Hours to milliseconds
              parseInt(minutes) * 60 * 1000 + // Minutes to milliseconds
              Math.round(parseFloat(seconds) * 1000); // Seconds to milliseconds

            dataItem = {
              output: outputs,
              filename: path.basename(file),
              startTime: currentTime,
              duration
            };

            currentTime += duration; // Update the start time for the next file
          }
        } catch (error: any) {
          // Extract metadata from the error output
          const durationMatch = error.stdout.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);

          if (durationMatch) {
            const [, hours, minutes, seconds] = durationMatch;
            const duration =
              parseInt(hours) * 3600 * 1000 + // Hours to milliseconds
              parseInt(minutes) * 60 * 1000 + // Minutes to milliseconds
              Math.round(parseFloat(seconds) * 1000); // Seconds to milliseconds

            dataItem = {
              output: outputs,
              filename: path.basename(file),
              startTime: currentTime,
              duration
            };

            currentTime += duration; // Update the start time for the next file
          } else {
            console.error(`Error getting duration for ${file}:`, error);
          }
        }

        return {
          code: `export default ${JSON.stringify(dataItem)};`,
          map: null,
        };
      }
    },

    async buildEnd() {
      if (audioFiles.length === 0) return;

      // Ensure the output directory exists
      fs.ensureDirSync(outputDir);
      fs.ensureDirSync(tempDir);

      // Create a temporary file listing all .mp3 files for ffmpeg
      const concatFilePath = path.join(tempDir, 'concat-list.txt');
      const concatFileContent = audioFiles
        .map((file) => `file '${file.replace(/\\/g, '/')}'`) // Escape Windows paths
        .join('\n');
      writeFileSync(concatFilePath, concatFileContent);

      // Merge the .mp3 files using ffmpeg-static
      try {
        let mp3Path = path.join(tempDir, filename+'.mp3');
        execSync(
          `"${ffmpegPath}" -loglevel error -y -f concat -safe 0 -i "${concatFilePath}" -c copy "${mp3Path}"`,
          { stdio: 'inherit' }
        );
      }
      catch (error) {
        console.error('Error merging audio files:', error);
        throw error;
      }

      // Generate the .webm file
      if (!outputTypes.includes('.webm')){
        const webmPath = path.join(tempDir, filename+'.webm');
        let mp3Path = path.join(tempDir, filename + '.mp3');
        try {
          execSync(
            `"${ffmpegPath}" -loglevel error -y -i "${mp3Path}" -c:a libvorbis "${webmPath}"`,
            { stdio: 'inherit' }
          );
        }
        catch (error) {
          console.error('Error converting merged audio to .webm:', error);
          throw error;
        }
      }

      // Clean up the temporary concat file
      fs.remove(concatFilePath);
    },

    writeBundle() {
      // Ensure the merged file is preserved in the dist folder
      if(outputTypes.includes('.mp3')){
        let mp3Path = path.join(tempDir, filename + '.mp3');
        let mp3OuputPath = path.join(outputDir, filename + '.mp3');
        fs.move(mp3Path, mp3OuputPath);
      }

      if (outputTypes.includes('.webm')){
        const webmPath = path.join(tempDir, filename+'.webm');
        const outputwebmPath = path.join(outputDir, filename+'.webm');
        fs.move(webmPath, outputwebmPath);
      }
    },

    configureServer(server) {
      // Serve the merged audio file during development
      server.middlewares.use((req, res, next) => {
        let tempMp3Path = path.join(tempDir, filename+'.mp3');
        let tempWebmPath = path.join(tempDir, filename+'.webm');

        if (req.url === tempMp3Path || req.url === tempWebmPath) {
          const filePath = req.url.endsWith('.mp3') ? path.join(tempDir, filename+'.mp3') : path.join(tempDir, filename+'.webm');

          if (existsSync(filePath)) {
            res.setHeader('Content-Type', req.url.endsWith('.mp3') ? 'audio/mpeg' : 'audio/webm');
            createReadStream(filePath).pipe(res);
            return;
          }
          else {
            res.statusCode = 404;
            res.end('File not found');
            return;
          }
        }
        next();
      });
    },
  };
}