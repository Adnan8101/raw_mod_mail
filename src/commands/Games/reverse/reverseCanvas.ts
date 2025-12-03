import { createCanvas } from 'canvas';
import { AttachmentBuilder } from 'discord.js';

export class ReverseCanvas {
    public static async generateImage(text: string): Promise<AttachmentBuilder> {
        const width = 800;
        const height = 400; // Taller for multi-line
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Add some noise
        ctx.fillStyle = '#f0f0f0';
        for (let i = 0; i < 100; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const s = Math.random() * 3;
            ctx.fillRect(x, y, s, s);
        }

        // Text settings
        ctx.font = 'bold 40px sans-serif';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Wrap text
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + " " + word).width;
            if (width < 700) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);

        const startX = width / 2;
        const startY = height / 2 - ((lines.length - 1) * 50) / 2;

        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], startX, startY + (i * 50));
        }

        // Add some lines
        ctx.strokeStyle = '#d0d0d0';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(0, Math.random() * height);
            ctx.lineTo(width, Math.random() * height);
            ctx.stroke();
        }

        return new AttachmentBuilder(canvas.toBuffer(), { name: 'reverse_challenge.png' });
    }
}
