/** Pure validation helpers — no React, no Supabase. Easy to unit test. */

export type AuthFieldErrors = { email?: string; password?: string }

/** 0–4: one point each for length ≥ 8, uppercase, digit, symbol. */
export function getPasswordStrength(pwd: string): number {
    let strength = 0
    if (pwd.length >= 8) strength++
    if (/[A-Z]/.test(pwd)) strength++
    if (/[0-9]/.test(pwd)) strength++
    if (/[^A-Za-z0-9]/.test(pwd)) strength++
    return strength
}

export function getStrengthLabel(strength: number): string {
    return strength <= 1 ? 'Weak' : strength === 2 ? 'Fair' : strength === 3 ? 'Good' : 'Strong'
}

export function getStrengthColor(strength: number): string {
    return strength <= 1 ? '#e74c3c' : strength === 2 ? '#e67e22' : strength === 3 ? '#f1c40f' : '#27ae60'
}

export function validateEmail(email: string): string | undefined {
    if (!email) return 'Email is required'
    if (!/\S+@\S+\.\S+/.test(email)) return 'Enter a valid email address'
    return undefined
}

/** Sign-up enforces the full policy; sign-in only checks a minimum length. */
export function validatePassword(password: string, mode: 'signIn' | 'signUp'): string | undefined {
    if (!password) return 'Password is required'
    if (mode === 'signUp') {
        if (password.length < 8) return 'Password must be at least 8 characters'
        if (!/[A-Z]/.test(password)) return 'Must contain an uppercase letter'
        if (!/[0-9]/.test(password)) return 'Must contain a number'
        if (!/[^A-Za-z0-9]/.test(password)) return 'Must contain a special character'
    } else if (password.length < 6) {
        return 'Password must be at least 6 characters'
    }
    return undefined
}

export function validateCredentials(email: string, password: string, mode: 'signIn' | 'signUp'): AuthFieldErrors {
    const errors: AuthFieldErrors = {}
    const emailError = validateEmail(email)
    const passwordError = validatePassword(password, mode)
    if (emailError) errors.email = emailError
    if (passwordError) errors.password = passwordError
    return errors
}
