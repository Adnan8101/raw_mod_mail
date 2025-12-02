import { createCanvas, registerFont } from 'canvas';
import { AttachmentBuilder } from 'discord.js';

export class VowelsCanvas {
    public static async generateImage(text: string): Promise<AttachmentBuilder> {
        const width = 800;
        const height = 300;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#ffffff'; // White background as requested
        ctx.fillRect(0, 0, width, height);

        // Add some noise (dots/lines) to confuse OCR
        ctx.fillStyle = '#e0e0e0';
        for (let i = 0; i < 100; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const s = Math.random() * 3;
            ctx.fillRect(x, y, s, s);
        }

        // Text settings
        ctx.font = 'bold 60px sans-serif';
        ctx.fillStyle = '#000000'; // Black text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Draw text with slight random positioning for each character (kerning/noise)
        const startX = width / 2 - (ctx.measureText(text).width / 2);
        const centerY = height / 2;

        let currentX = startX;

        // If text is too long, we might need to wrap or scale down. 
        // For now, assuming the difficulty constraints keep it within bounds.
        // But let's do a quick check and scale if needed.
        const totalWidth = ctx.measureText(text).width;
        if (totalWidth > width - 100) {
            const scale = (width - 100) / totalWidth;
            ctx.scale(scale, scale);
            // Adjust center since we scaled
            // Actually scaling context is tricky with individual char drawing.
            // Let's just reduce font size if it's too long.
            ctx.font = 'bold 40px sans-serif';
            // Recalculate startX
            currentX = width / 2 - (ctx.measureText(text).width / 2);
        }

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const charWidth = ctx.measureText(char).width;

            // Random slight offset
            const offsetX = (Math.random() - 0.5) * 5;
            const offsetY = (Math.random() - 0.5) * 5;
            const angle = (Math.random() - 0.5) * 0.1; // Slight rotation

            ctx.save();
            ctx.translate(currentX + charWidth / 2 + offsetX, centerY + offsetY);
            ctx.rotate(angle);
            ctx.fillText(char, 0, 0);
            ctx.restore();

            currentX += charWidth + 2; // Add a little spacing
        }

        // Add some lines over the text to further confuse OCR
        ctx.strokeStyle = '#d0d0d0';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(0, Math.random() * height);
            ctx.lineTo(width, Math.random() * height);
            ctx.stroke();
        }

        return new AttachmentBuilder(canvas.toBuffer(), { name: 'vowels_challenge.png' });
    }
}
