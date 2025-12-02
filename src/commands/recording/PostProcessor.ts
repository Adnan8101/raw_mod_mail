
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export class PostProcessor {
    public static async processSession(sessionDir: string, formats: { wav: boolean; mp3: boolean; opus: boolean; flac: boolean }): Promise<string[]> {
        console.log(`Processing session in ${sessionDir}`);
        const files = fs.readdirSync(sessionDir).filter(f => f.startsWith('user_') && f.endsWith('.pcm'));
        console.log(`Found ${files.length} PCM files to mix.`);

        if (files.length === 0) {
            return [];
        }

        const inputs: string[] = [];
        const inputArgs: string[] = [];

        // Build input args for each file
        for (const file of files) {
            const inputPath = path.join(sessionDir, file);
            inputs.push(inputPath);
            inputArgs.push('-f', 's16le', '-ar', '48000', '-ac', '2', '-i', inputPath);
        }

        const outputFiles: string[] = [];
        const timestamp = Date.now();
        const mixedBasename = `recording_${timestamp}`;

        // Complex filter for mixing and enhancement
        // [0:a][1:a]...amix=inputs=N:duration=longest[mixed];[mixed]highpass...[out]
        const mixFilter = `amix=inputs=${files.length}:duration=longest`;
        const audioFilters = `${mixFilter},highpass=f=50,dynaudnorm=f=150:g=15,compand=attacks=0:points=-80/-80|-12.4/-12.4|-6/-6|0/-3|20/-3`;

        const outputArgs = ['-filter_complex', audioFilters];

        // We only produce one file based on priority: MP3 > WAV > Opus > FLAC
        // Or should we produce all requested? User said "only 1 one studiioo grade filee".
        // Let's default to MP3 320k if selected, otherwise WAV.

        // Actually, let's just produce MP3 320k as the standard "studio grade" shareable format
        // unless they specifically asked for something else. But the user said "only 1 file".
        // Let's stick to MP3 320k for now as it's the most compatible and high quality.

        const outputPath = path.join(sessionDir, `${mixedBasename}.mp3`);
        await this.convertMixed(inputs, outputPath, inputArgs, [...outputArgs, '-b:a', '320k']);
        outputFiles.push(outputPath);

        return outputFiles;
    }

    private static convertMixed(inputs: string[], output: string, inputArgs: string[], outputArgs: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            // inputArgs already contains -i inputPath
            // We need to construct the command carefully.
            // spawn('ffmpeg', [...inputArgs, ...outputArgs, output])

            // Wait, inputArgs in my loop above included '-i', 'path'.
            // So we just spread them.

            const ffmpeg = spawn('ffmpeg', [
                ...inputArgs,
                ...outputArgs,
                output
            ]);

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    console.error(`FFmpeg exited with code ${code}`);
                    reject(new Error(`FFmpeg exited with code ${code}`));
                }
            });

            ffmpeg.on('error', (err) => {
                console.error('FFmpeg error:', err);
                reject(err);
            });
        });
    }


}
