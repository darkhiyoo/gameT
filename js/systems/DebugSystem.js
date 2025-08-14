class DebugSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.enabled = true;
        this.showCoordinates = false; // Default to false (unchecked)
        this.showEntityPositions = false; // Default to false (unchecked)
        this.showCollisionBounds = false;
        this.mousePosition = { x: 0, y: 0 };
        this.camera = { x: 0, y: 0 };
        
        // Create debug UI panel
        this.createDebugUI();
        
        // Track mouse position
        this.setupMouseTracking();
    }

    createDebugUI() {
        // Create debug panel
        const debugPanel = document.createElement('div');
        debugPanel.id = 'debugPanel';
        debugPanel.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: #00ff00;
            padding: 10px;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            z-index: 5000; /* Ensure above canvas/editors */
            min-width: 200px;
        `;
        
        debugPanel.innerHTML = `
            <div style="color: #ffff00; font-weight: bold; margin-bottom: 5px;">DEBUG INFO</div>
            <div id="mouseCoords">Mouse: (0, 0)</div>
            <div id="worldCoords">World: (0, 0)</div>
            <div id="cameraPos">Camera: (0, 0)</div>
            <div id="entityCount">Entities: 0</div>
            <div style="margin-top: 5px;">
                <label><input type="checkbox" id="toggleCoords"> Coordinates</label><br>
                <label><input type="checkbox" id="toggleEntities"> Entity Positions</label><br>
                <label><input type="checkbox" id="toggleCollision"> Collision Bounds</label>
            </div>
        `;
        
        document.getElementById('gameContainer').appendChild(debugPanel);
        // Floating toggle button (persists even when panel hidden)
        if(!document.getElementById('debugToggleBtn')){
            const btn=document.createElement('button');
            btn.id='debugToggleBtn';
            btn.textContent='Debug';
            btn.style.cssText=`position:absolute;top:10px;right:220px;z-index:5001;background:#222;color:#0f0;border:1px solid #0f0;padding:4px 8px;cursor:pointer;font-family:'Courier New',monospace;font-size:12px;`;
            btn.addEventListener('click',()=>{ debugPanel.style.display = (debugPanel.style.display==='none')?'block':'none'; });
            document.getElementById('gameContainer').appendChild(btn);
        }
        
        // Setup toggle listeners
        document.getElementById('toggleCoords').addEventListener('change', (e) => {
            this.showCoordinates = e.target.checked;
        });
        
        document.getElementById('toggleEntities').addEventListener('change', (e) => {
            this.showEntityPositions = e.target.checked;
        });
        
        document.getElementById('toggleCollision').addEventListener('change', (e) => {
            this.showCollisionBounds = e.target.checked;
        });
    }

    setupMouseTracking() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mousePosition.x = e.clientX - rect.left;
            this.mousePosition.y = e.clientY - rect.top;
        });
    }

    update(entities, camera) {
        this.camera = camera;
        
        // Update debug panel
        const worldX = this.mousePosition.x + camera.x;
        const worldY = this.mousePosition.y + camera.y;
        
        document.getElementById('mouseCoords').textContent = 
            `Mouse: (${this.mousePosition.x.toFixed(0)}, ${this.mousePosition.y.toFixed(0)})`;
        document.getElementById('worldCoords').textContent = 
            `World: (${worldX.toFixed(0)}, ${worldY.toFixed(0)})`;
        document.getElementById('cameraPos').textContent = 
            `Camera: (${camera.x.toFixed(0)}, ${camera.y.toFixed(0)})`;
        document.getElementById('entityCount').textContent = 
            `Entities: ${entities.length}`;
    }

    render(ctx, entities, camera) {
        if (!this.enabled) return;
        
        ctx.save();
        
        // Render coordinate grid
        if (this.showCoordinates) {
            this.renderCoordinateGrid(ctx, camera);
        }
        
        // Render entity positions
        if (this.showEntityPositions) {
            this.renderEntityPositions(ctx, entities, camera);
        }
        
        // Render collision bounds
        if (this.showCollisionBounds) {
            this.renderCollisionBounds(ctx, entities, camera);
        }
        
        // Render mouse crosshair
        this.renderMouseCrosshair(ctx, camera);
        
        ctx.restore();
    }

    renderCoordinateGrid(ctx, camera) {
        const gridSize = 50;
        const startX = Math.floor(camera.x / gridSize) * gridSize;
        const startY = Math.floor(camera.y / gridSize) * gridSize;
        const endX = camera.x + this.canvas.width;
        const endY = camera.y + this.canvas.height;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.font = '10px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        
        // Vertical lines
        for (let x = startX; x <= endX + gridSize; x += gridSize) {
            const screenX = x - camera.x;
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, this.canvas.height);
            ctx.stroke();
            
            // X coordinate labels
            if (x % (gridSize * 4) === 0) {
                ctx.fillText(x.toString(), screenX + 2, 12);
            }
        }
        
        // Horizontal lines
        for (let y = startY; y <= endY + gridSize; y += gridSize) {
            const screenY = y - camera.y;
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(this.canvas.width, screenY);
            ctx.stroke();
            
            // Y coordinate labels
            if (y % (gridSize * 4) === 0) {
                ctx.fillText(y.toString(), 2, screenY - 2);
            }
        }
    }

    renderEntityPositions(ctx, entities, camera) {
        ctx.font = '10px Arial';
        
        entities.forEach(entity => {
            const screenX = entity.position.x - camera.x;
            const screenY = entity.position.y - camera.y;
            
            // Skip entities outside view
            if (screenX < -50 || screenX > this.canvas.width + 50 || 
                screenY < -50 || screenY > this.canvas.height + 50) return;
            
            // Entity position dot
            ctx.fillStyle = this.getEntityColor(entity);
            ctx.beginPath();
            ctx.arc(screenX + entity.size.x / 2, screenY + entity.size.y / 2, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Position label
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            const x = Math.round(entity.position.x);
            const y = Math.round(entity.position.y);
            ctx.fillText(`(${x},${y})`, screenX, screenY - 5);
            
            // Entity type label
            ctx.fillStyle = this.getEntityColor(entity);
            const entityType = entity.constructor.name;
            ctx.fillText(entityType, screenX, screenY + entity.size.y + 15);
        });
    }

    renderCollisionBounds(ctx, entities, camera) {
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        
        entities.forEach(entity => {
            if (!entity.solid) return;
            // Skip base/invisible walls unless collision editor is active (game.collisionEditor?.active)
            if (entity.collisionLayer === 'wall' && entity.visible === false && window.game && window.game.collisionEditor && !window.game.collisionEditor.active) {
                return;
            }
            
            const screenX = entity.position.x - camera.x;
            const screenY = entity.position.y - camera.y;
            
            ctx.strokeRect(screenX, screenY, entity.size.x, entity.size.y);
        });
    }

    renderMouseCrosshair(ctx, camera) {
        const x = this.mousePosition.x;
        const y = this.mousePosition.y;
        
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
        ctx.lineWidth = 1;
        
        // Crosshair lines
        ctx.beginPath();
        ctx.moveTo(x - 10, y);
        ctx.lineTo(x + 10, y);
        ctx.moveTo(x, y - 10);
        ctx.lineTo(x, y + 10);
        ctx.stroke();
        
        // Coordinate text
        const worldX = x + camera.x;
        const worldY = y + camera.y;
        ctx.fillStyle = 'rgba(255, 255, 0, 1)';
        ctx.font = '12px Arial';
        ctx.fillText(`(${worldX.toFixed(0)}, ${worldY.toFixed(0)})`, x + 15, y - 5);
    }

    getEntityColor(entity) {
        if (entity instanceof Player) return '#00ff00';
        if (entity instanceof Enemy) return '#ff0000';
        if (entity instanceof Bullet) return '#ffff00';
        if (entity.collisionLayer === 'wall') return '#888888';
        return '#ffffff';
    }

    toggle() {
        this.enabled = !this.enabled;
        const panel = document.getElementById('debugPanel');
        if (panel) {
            panel.style.display = this.enabled ? 'block' : 'none';
        }
    }

    // Method to highlight specific coordinates (for wall placement)
    highlightCoordinate(x, y, color = '#ff00ff', size = 10) {
        // This can be called to mark specific coordinates for wall placement
        return {
            x: x,
            y: y,
            color: color,
            size: size,
            render: (ctx, camera) => {
                const screenX = x - camera.x;
                const screenY = y - camera.y;
                
                ctx.fillStyle = color;
                ctx.fillRect(screenX - size/2, screenY - size/2, size, size);
                
                ctx.fillStyle = '#ffffff';
                ctx.font = '10px Arial';
                ctx.fillText(`(${x},${y})`, screenX + size/2 + 5, screenY);
            }
        };
    }
}
