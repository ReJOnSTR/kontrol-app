export const authService = {
    register: (userData) => window.electronAPI.register(userData),
    login: (credentials) => window.electronAPI.login(credentials),
    changePassword: (data) => window.electronAPI.changePassword(data),
    updateProfile: (data) => window.electronAPI.updateProfile(data),
    createEmployeeUser: (data) => window.electronAPI.createEmployeeUser(data),
    sendPersonnelInvite: (data) => window.electronAPI.sendPersonnelInvite(data)
}
