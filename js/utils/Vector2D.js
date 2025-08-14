class Vector2D {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    // Basic operations
    add(vector) {
        return new Vector2D(this.x + vector.x, this.y + vector.y);
    }

    subtract(vector) {
        return new Vector2D(this.x - vector.x, this.y - vector.y);
    }

    multiply(scalar) {
        return new Vector2D(this.x * scalar, this.y * scalar);
    }

    divide(scalar) {
        if (scalar === 0) return new Vector2D(0, 0);
        return new Vector2D(this.x / scalar, this.y / scalar);
    }

    // Vector properties
    magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    normalize() {
        const mag = this.magnitude();
        if (mag === 0) return new Vector2D(0, 0);
        return this.divide(mag);
    }

    // Distance and direction
    distanceTo(vector) {
        return this.subtract(vector).magnitude();
    }

    dot(vector) {
        return this.x * vector.x + this.y * vector.y;
    }

    angle() {
        return Math.atan2(this.y, this.x);
    }

    angleTo(vector) {
        return Math.atan2(vector.y - this.y, vector.x - this.x);
    }

    // Utility methods
    copy() {
        return new Vector2D(this.x, this.y);
    }

    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    equals(vector) {
        return this.x === vector.x && this.y === vector.y;
    }

    lerp(vector, t) {
        return new Vector2D(
            this.x + (vector.x - this.x) * t,
            this.y + (vector.y - this.y) * t
        );
    }

    // Static methods
    static fromAngle(angle, magnitude = 1) {
        return new Vector2D(
            Math.cos(angle) * magnitude,
            Math.sin(angle) * magnitude
        );
    }

    static zero() {
        return new Vector2D(0, 0);
    }

    static one() {
        return new Vector2D(1, 1);
    }

    static random() {
        return new Vector2D(
            Math.random() * 2 - 1,
            Math.random() * 2 - 1
        ).normalize();
    }
}
