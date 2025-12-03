import { createCanvas } from 'canvas';
import { AttachmentBuilder } from 'discord.js';

export class SequenceCanvas {
    public static async generateImage(sequence: string): Promise<AttachmentBuilder> {
        const width = 800;
        const height = 300;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Add some noise
        ctx.fillStyle = '#e0e0e0';
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const s = Math.random() * 4;
            ctx.fillRect(x, y, s, s);
        }

        // Text settings
        ctx.font = 'bold 60px sans-serif';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Draw text
        // We might need to scale down if the sequence is long
        const textWidth = ctx.measureText(sequence).width;
        if (textWidth > width - 100) {
            const scale = (width - 100) / textWidth;
            // ctx.scale(scale, scale); // Scaling context affects position too
            // Simpler to just reduce font size
            const newSize = Math.floor(60 * scale);
            ctx.font = `bold ${newSize}px sans-serif`;
        }

        const startX = width / 2;
        const centerY = height / 2;

        // Slight rotation for the whole line or individual chars?
        // User said "minor anti-OCR adjustments".
        // Let's rotate the whole canvas slightly.
        const angle = (Math.random() - 0.5) * 0.05; // Very slight
        ctx.translate(startX, centerY);
        ctx.rotate(angle);
        ctx.fillText(sequence, 0, 0);

        // Reset transform
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Add some lines
        ctx.strokeStyle = '#d0d0d0';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(0, Math.random() * height);
            ctx.lineTo(width, Math.random() * height);
            ctx.stroke();
        }

        return new AttachmentBuilder(canvas.toBuffer(), { name: 'sequence_challenge.png' });
    }
}
