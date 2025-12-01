import { createCanvas } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

async function generateTestImage() {
    const difficulty = 'Hard';
    const numbers: number[] = [];
    // Generate 110 numbers for Hard mode (chunkSize = 110)
    // Start from 1000
    for (let i = 0; i < 110; i++) {
        numbers.push(1000 + i);
    }

    // --- LOGIC FROM hiddenGameInstance.ts ---

    const count = numbers.length;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);

    // Adjust canvas size based on rows/cols
    // Add padding
    const padding = 40;

    // Adjust cell size based on difficulty/content
    // Hard mode has 4 digits, so we need more width.
    let cellWidth = 100;
    if (difficulty === 'Hard') {
        cellWidth = 140;
    } else if (difficulty === 'Medium') {
        cellWidth = 120;
    }

    const cellHeight = 80;

    const width = (cols * cellWidth) + (padding * 2);
    const height = (rows * cellHeight) + (padding * 2);

    console.log(`Generating canvas: ${width}x${height}`);
    console.log(`Cols: ${cols}, Rows: ${rows}`);
    console.log(`Cell Width: ${cellWidth}, Cell Height: ${cellHeight}`);
    console.log(`Padding: ${padding}`);

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#2b2d31'; // Discord dark theme backgroundish
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw numbers
    ctx.font = 'bold 40px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < numbers.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);

        // Calculate x and y with padding
        const x = padding + (col * cellWidth) + (cellWidth / 2);
        const y = padding + (row * cellHeight) + (cellHeight / 2);

        // Verify bounds
        if (x < padding || x > width - padding) {
            console.error(`ERROR: Text at index ${i} (x=${x}) is outside horizontal safe area!`);
        }
        if (y < padding || y > height - padding) {
            console.error(`ERROR: Text at index ${i} (y=${y}) is outside vertical safe area!`);
        }

        ctx.fillText(numbers[i].toString(), x, y);
    }

    // --- END LOGIC ---

    const buffer = canvas.toBuffer('image/png');
    const outputPath = path.resolve(__dirname, '../artifacts/hidden_grid_test.png');

    // Ensure artifacts dir exists
    const artifactsDir = path.dirname(outputPath);
    if (!fs.existsSync(artifactsDir)) {
        fs.mkdirSync(artifactsDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, buffer);
    console.log(`Image saved to: ${outputPath}`);
}

generateTestImage().catch(console.error);
