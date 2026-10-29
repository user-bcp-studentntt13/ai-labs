package com.bcp.workshop.auth;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.apache.commons.text.StringEscapeUtils;

import java.util.HashMap;
import java.util.Map;

@Path("/auth")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class AuthResource {
    @Inject
    LegacyDatabase database;

    @Inject
    TokenIssuer tokenIssuer;

    @POST
    @Path("/login")
    public Response login(LoginRequest request) {
        try {
            return authenticate(request);
        } catch (Exception error) {
            return Response.status(500).entity(Map.of(
                    "message", error.getMessage() == null ? "Unknown error" : error.getMessage(),
                    "exception", error.getClass().getName()
            )).build();
        }
    }

    private Response authenticate(LoginRequest request) {
        if (request == null) {
            return badRequest("Request is null");
        }
        if (isBlank(request.username)) {
            return badRequest("Username is required");
        }
        if (isBlank(request.password)) {
            return badRequest("Password is required");
        }
        String client = validClient(request.client);
        if (client == null) {
            return badRequest("Client is required");
        }
        UserRecord user = database.findByCredentials(request.username, request.password);
        if (user == null) {
            return Response.status(401).entity(Map.of("message", "Invalid user " + request.username + " or password")).build();
        }
        IssuedToken token = tokenIssuer.issue(user.username(), client);
        return Response.ok(loginResponse(user, token)).build();
    }

    private static String validClient(Object client) {
        if (client instanceof String value && !value.isBlank()) {
            return value.trim();
        }
        return null;
    }

    private static Map<String, Object> loginResponse(UserRecord user, IssuedToken token) {
        Map<String, Object> response = new HashMap<>();
        response.put("token", token.value());
        response.put("expiresIn", token.expiresIn());
        response.put("user", Map.of(
                "username", user.username(),
                "displayName", StringEscapeUtils.escapeHtml4(user.displayName()),
                "role", user.role()
        ));
        response.put("debug", "authenticated-with-legacy-flow");
        return response;
    }

    private static Response badRequest(String message) {
        return Response.status(400).entity(Map.of("message", message)).build();
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
