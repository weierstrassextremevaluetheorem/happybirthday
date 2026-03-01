// =============================================
// CONFIGURATION – edit your 16 messages here!
// =============================================
const MESSAGES = [
    "I hope you get all the cheesecake you’ll ever want in your life LOL.",
    "I hope you do well in your exams, good luck for physics and maths today!! (and other subjects later)",
    "I hope you’re always happy and that good things always come your way >:)",
    "I know I always say “maybe…” but you ARE the coolest person I know.. (if you ask again I will say maybe tho.)",
    "You’re fun to ragebait but it’s kinda funny",
    "I’m really happy around you!",
    "This is all I can do for now but if I was IRL I could do something better TSK.",
    "I hope you have a great 16th birthday!!",
    "This was what I was struggling to think about LOL DO U REALLY THINK I STRUGGLE WITH DEBATE… (I am washed tho)",
    "I HOPE U LIKE THIS GIFT!!",
    "I lowkey like playing guessing games with you cuz it lets me get to know you better and I wanna know you better.",
    "You’re kinda like my fav person to talk to ngl",
    "I want cheesecake, tiramisu and affogato ngl…",
    "Malcolm Todd Concert when",
    "Ik these thoughts are so random but I PROMISE stay till the confetti ends",
    "Transform 3:04 (I like that part i js wanted to include this here)"
];

// =============================================
// Constants
// =============================================
const NUM_SLICES = 16;
const canvas = document.getElementById("cheesecake");
const ctx = canvas.getContext("2d");
const W = 700;
const H = 700;
const CX = W / 2;
const CY = H / 2;
const RADIUS = 210;
const CRUST_WIDTH = 18;
const TOPPING_RADIUS = 100;
const PULL_DISTANCE = 130;
const SLICE_ANGLE = (2 * Math.PI) / NUM_SLICES;

// Colors – warm cheesecake palette
const COL = {
    body: "#ffe680",        // bright cheesecake yellow
    bodyShade: "#f5d44b",   // slightly darker shade for alternating slices
    crust: "#c88b3c",       // golden brown crust
    crustDark: "#a06b20",   // darker crust edge
    topping: "#ffcc00",     // rich golden topping center
    toppingShade: "#f0b800",
    line: "#5a3e1b",        // dark brown outlines
    shadow: "rgba(90,62,27,0.25)",
    candle: "#fff5cc",
    candleStripe: "#ffc947",
    flame1: "#ff9900",
    flame2: "#ffdd33",
};

// =============================================
// State
// =============================================
const slices = [];
let revealedCount = 0;
let dragging = null; // { index, startX, startY }
let animFrame = null;
let time = 0;

class Slice {
    constructor(index) {
        this.index = index;
        this.startAngle = index * SLICE_ANGLE - Math.PI / 2;
        this.endAngle = (index + 1) * SLICE_ANGLE - Math.PI / 2;
        this.midAngle = (this.startAngle + this.endAngle) / 2;
        this.state = "whole"; // whole -> cut -> revealed
        this.pullX = 0;
        this.pullY = 0;
        this.targetPullX = 0;
        this.targetPullY = 0;
        this.message = MESSAGES[index] || `Slice ${index + 1}`;
        this.cutAnim = 0; // 0 to 1
    }
}

function init() {
    for (let i = 0; i < NUM_SLICES; i++) {
        slices.push(new Slice(i));
    }
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);
    // Touch
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    document.getElementById("start-btn").addEventListener("click", () => {
        document.getElementById("landing-screen").style.display = "none";
        document.getElementById("game-container").style.display = "flex";
    });

    document.getElementById("popup-close").addEventListener("click", () => {
        document.getElementById("message-popup").classList.add("hidden");
    });

    loop();
}

// =============================================
// Input helpers
// =============================================
function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
    };
}

function getSliceAtPos(x, y) {
    // Check pulled-out slices first (on top)
    for (let i = slices.length - 1; i >= 0; i--) {
        const s = slices[i];
        if (s.state === "revealed") continue;
        const sx = CX + s.pullX;
        const sy = CY + s.pullY;
        const dx = x - sx;
        const dy = y - sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        // normalise angle
        let a = angle;
        let sa = s.startAngle;
        let ea = s.endAngle;
        // Normalize
        while (a < sa - Math.PI) a += 2 * Math.PI;
        while (a > sa + Math.PI) a -= 2 * Math.PI;
        if (dist <= RADIUS && a >= sa && a <= ea) return i;
    }
    return -1;
}

// =============================================
// Mouse events
// =============================================
function onMouseDown(e) {
    const { x, y } = getCanvasPos(e);
    const idx = getSliceAtPos(x, y);
    if (idx < 0) return;
    const s = slices[idx];

    if (s.state === "whole") {
        // First click: cut it
        s.state = "cut";
        s.targetPullX = Math.cos(s.midAngle) * 30;
        s.targetPullY = Math.sin(s.midAngle) * 30;
        // Start drag
        dragging = { index: idx, startX: x, startY: y, origPX: s.pullX, origPY: s.pullY };
    } else if (s.state === "cut") {
        // If it's already pulled out far enough, clicking reveals. Otherwise start drag.
        const pullDist = Math.sqrt(s.pullX * s.pullX + s.pullY * s.pullY);
        if (pullDist > PULL_DISTANCE * 0.6) {
            revealSlice(s);
        } else {
            dragging = { index: idx, startX: x, startY: y, origPX: s.pullX, origPY: s.pullY };
        }
    }
}

function onMouseMove(e) {
    if (!dragging) return;
    const { x, y } = getCanvasPos(e);
    const s = slices[dragging.index];
    // Project drag delta onto the slice's mid-angle direction
    const dx = x - dragging.startX;
    const dy = y - dragging.startY;
    const projectedDist = dx * Math.cos(s.midAngle) + dy * Math.sin(s.midAngle);
    const dist = Math.max(0, Math.min(PULL_DISTANCE, projectedDist + Math.sqrt(dragging.origPX ** 2 + dragging.origPY ** 2)));
    s.targetPullX = Math.cos(s.midAngle) * dist;
    s.targetPullY = Math.sin(s.midAngle) * dist;
}

function onMouseUp() {
    dragging = null;
}

// Touch
function onTouchStart(e) {
    e.preventDefault();
    const t = e.touches[0];
    onMouseDown({ clientX: t.clientX, clientY: t.clientY });
}
function onTouchMove(e) {
    e.preventDefault();
    const t = e.touches[0];
    onMouseMove({ clientX: t.clientX, clientY: t.clientY });
}
function onTouchEnd() {
    onMouseUp();
}

// =============================================
// Reveal
// =============================================
function revealSlice(s) {
    s.state = "revealed";
    revealedCount++;
    document.getElementById("revealed-count").textContent = revealedCount;

    // Show popup
    document.getElementById("popup-text").textContent = s.message;
    document.getElementById("message-popup").classList.remove("hidden");

    if (revealedCount === NUM_SLICES) {
        setTimeout(() => {
            launchConfetti();
            setTimeout(() => {
                window.location.href = "https://digibouquet.vercel.app/bouquet/70dbe4f7-efa9-4bc4-be00-51849426c2a8";
            }, 3000); // Redirect 3 seconds after confetti
        }, 600);
    }
}

// =============================================
// Drawing
// =============================================

// Draw a single slice. If it's whole, it stays at (0,0). If cut/revealed, it uses pullX/pullY.
function drawSlice(s) {
    const px = (s.state === "whole") ? 0 : s.pullX;
    const py = (s.state === "whole") ? 0 : s.pullY;
    const cx = CX + px;
    const cy = CY + py;

    if (s.state === "revealed") {
        ctx.globalAlpha = 0.15;
    }

    // Shadow under pulled slices
    if (s.state === "cut" && (px !== 0 || py !== 0)) {
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.moveTo(cx + 4, cy + 6);
        ctx.arc(cx + 4, cy + 6, RADIUS, s.startAngle, s.endAngle);
        ctx.closePath();
        ctx.fillStyle = "#000";
        ctx.fill();
        ctx.restore();
        if (s.state !== "revealed") ctx.globalAlpha = 1;
    }

    // Fill Crust
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, RADIUS, s.startAngle, s.endAngle);
    ctx.closePath();
    ctx.fillStyle = COL.crust;
    ctx.fill();

    // Fill Body
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, RADIUS - CRUST_WIDTH, s.startAngle, s.endAngle);
    ctx.closePath();
    ctx.fillStyle = COL.body;
    ctx.fill();

    // Fill Topping
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, TOPPING_RADIUS, s.startAngle, s.endAngle);
    ctx.closePath();
    ctx.fillStyle = COL.topping;
    ctx.fill();

    // Instead of drawing strokes for each layer separately (which creates internal overlapping lines),
    // we just draw the outline for the entire slice once on top of the fills.
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, RADIUS, s.startAngle, s.endAngle);
    ctx.closePath();

    // Draw the dividing arc between crust and body
    ctx.moveTo(cx + Math.cos(s.startAngle) * (RADIUS - CRUST_WIDTH), cy + Math.sin(s.startAngle) * (RADIUS - CRUST_WIDTH));
    ctx.arc(cx, cy, RADIUS - CRUST_WIDTH, s.startAngle, s.endAngle);

    // Draw the dividing arc between body and topping
    ctx.moveTo(cx + Math.cos(s.startAngle) * TOPPING_RADIUS, cy + Math.sin(s.startAngle) * TOPPING_RADIUS);
    ctx.arc(cx, cy, TOPPING_RADIUS, s.startAngle, s.endAngle);

    ctx.strokeStyle = COL.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.globalAlpha = 1;
}

function drawCandle(s) {
    if (s.state === "revealed") return;
    const px = s.pullX;
    const py = s.pullY;
    const cr = RADIUS * 0.6;
    const cx = CX + px + Math.cos(s.midAngle) * cr;
    const cy = CY + py + Math.sin(s.midAngle) * cr;
    const candleH = 28;
    const candleW = 7;

    // Candle body
    ctx.fillStyle = COL.candle;
    ctx.fillRect(cx - candleW / 2, cy - candleH, candleW, candleH);
    // Stripe
    ctx.fillStyle = COL.candleStripe;
    for (let i = 0; i < candleH; i += 6) {
        ctx.fillRect(cx - candleW / 2, cy - candleH + i, candleW, 3);
    }
    ctx.strokeStyle = COL.line;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - candleW / 2, cy - candleH, candleW, candleH);

    // Flame
    const flicker = Math.sin(time * 8 + s.index * 2) * 2;
    const fh = 12 + Math.sin(time * 12 + s.index) * 2;
    ctx.beginPath();
    ctx.ellipse(cx + flicker * 0.5, cy - candleH - fh / 2, 5, fh / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = COL.flame1;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + flicker * 0.3, cy - candleH - fh / 2 + 1, 3, fh / 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = COL.flame2;
    ctx.fill();

    // Glow
    const grad = ctx.createRadialGradient(cx, cy - candleH - fh / 2, 0, cx, cy - candleH - fh / 2, 20);
    grad.addColorStop(0, "rgba(255,200,50,0.25)");
    grad.addColorStop(1, "rgba(255,200,50,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 20, cy - candleH - fh - 10, 40, 40);
}

function draw() {
    ctx.clearRect(0, 0, W, H);

    // 1. Draw all whole slices
    for (const s of slices) {
        if (s.state === "whole") drawSlice(s);
    }

    // 2. Candles on whole slices
    for (const s of slices) {
        if (s.state === "whole") drawCandle(s);
    }

    // 3. Draw pulled slices on top
    for (const s of slices) {
        if (s.state !== "whole") drawSlice(s);
    }
    for (const s of slices) {
        if (s.state === "cut") drawCandle(s);
    }

    // 4. "Click!" hint on pulled-out slices
    for (const s of slices) {
        if (s.state === "cut") {
            const pullDist = Math.sqrt(s.pullX ** 2 + s.pullY ** 2);
            if (pullDist > PULL_DISTANCE * 0.6) {
                const tx = CX + s.pullX + Math.cos(s.midAngle) * RADIUS * 0.45;
                const ty = CY + s.pullY + Math.sin(s.midAngle) * RADIUS * 0.45;
                ctx.save();
                ctx.font = "9px 'Press Start 2P'";
                ctx.fillStyle = "#5a3e1b";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("Click!", tx, ty);
                ctx.restore();
            }
        }
    }
}

// =============================================
// Animation loop
// =============================================
function loop() {
    time += 0.016;

    // Ease pull positions
    for (const s of slices) {
        s.pullX += (s.targetPullX - s.pullX) * 0.15;
        s.pullY += (s.targetPullY - s.pullY) * 0.15;
    }

    draw();
    animFrame = requestAnimationFrame(loop);
}

// =============================================
// Confetti
// =============================================
function launchConfetti() {
    const colors = ["#ffc947", "#ffe680", "#c88b3c", "#ff9900", "#ffdd33", "#5a3e1b"];
    for (let i = 0; i < 180; i++) {
        const c = document.createElement("div");
        c.className = "confetti";
        c.style.left = Math.random() * 100 + "vw";
        c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        c.style.animationDuration = Math.random() * 3 + 2 + "s";
        c.style.animationDelay = Math.random() * 1 + "s";
        c.style.width = (Math.random() * 8 + 6) + "px";
        c.style.height = (Math.random() * 8 + 6) + "px";
        document.body.appendChild(c);
    }
}

// =============================================
// Boot
// =============================================
init();
