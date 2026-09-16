// Reuse the persisted Firebase identity; changing a nickname must not create a user.
export async function anonymousIdentity(auth, signInAnonymously) {
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  return (await signInAnonymously(auth)).user;
}
