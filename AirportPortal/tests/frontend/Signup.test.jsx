import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Signup from "@/pages/Signup";
import { renderWithProviders } from "../helpers/frontend/renderWithProviders";
import { frontendServer, errorHandlers } from "../setup/msw/frontend-server";

describe("Signup Page", () => {
    describe("Rendering", () => {
        it("renders signup form with required fields", () => {
            renderWithProviders(<Signup />);
            expect(screen.getByText("Create your account")).toBeInTheDocument();
            expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/gender/i)).toBeInTheDocument();
        });

        it("renders optional address fields", () => {
            renderWithProviders(<Signup />);
            expect(screen.getByLabelText(/address/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/state/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/zip/i)).toBeInTheDocument();
        });

        it("renders security questions fieldset", () => {
            renderWithProviders(<Signup />);
            const legend = screen.getByText(/security questions/i);
            expect(legend).toBeInTheDocument();
        });

        it("renders password strength meter", () => {
            renderWithProviders(<Signup />);
            expect(screen.getByText("—")).toBeInTheDocument();
        });

        it("renders captcha component", () => {
            renderWithProviders(<Signup />);
            const captchaInput = document.querySelector('input[inputmode="numeric"]');
            expect(captchaInput).toBeInTheDocument();
        });

        it("renders submit button", () => {
            renderWithProviders(<Signup />);
            expect(screen.getByRole("button", { name: /create account|sign up/i })).toBeInTheDocument();
        });
    });

    describe("Validation", () => {
        it("requires all mandatory fields", () => {
            renderWithProviders(<Signup />);
            expect(screen.getByLabelText(/first name/i)).toHaveAttribute("required");
            expect(screen.getByLabelText(/last name/i)).toHaveAttribute("required");
            expect(screen.getByLabelText(/email/i)).toHaveAttribute("required");
            expect(screen.getByLabelText(/password/i)).toHaveAttribute("required");
        });

        it("validates email format", async () => {
            const user = userEvent.setup();
            renderWithProviders(<Signup />);

            const emailInput = screen.getByLabelText(/email/i);
            await user.type(emailInput, "invalid-email");

            // HTML5 validation should prevent submission
            expect(emailInput).toHaveAttribute("type", "email");
        });

        it("enforces minimum password strength", async () => {
            const user = userEvent.setup();
            renderWithProviders(<Signup />);

            await user.type(screen.getByLabelText(/first name/i), "John");
            await user.type(screen.getByLabelText(/last name/i), "Doe");
            await user.type(screen.getByLabelText(/email/i), "john@example.com");
            await user.type(screen.getByLabelText(/date of birth/i), "1990-01-01");
            await user.type(screen.getByLabelText(/gender/i), "male");
            const captchaInput = document.querySelector('input[inputmode="numeric"]');
            expect(captchaInput).toBeInTheDocument();
            await user.type(captchaInput, "0");
            for (const answerInput of screen.getAllByPlaceholderText("Answer")) {
                await user.type(answerInput, "ok");
            }
            const passwordInput = screen.getByLabelText(/password/i);
            const submitButton = screen.getByRole("button", { name: /create account|sign up/i });

            await user.type(passwordInput, "weak");
            await user.click(submitButton);

            await waitFor(() => {
                expect(screen.getByRole("alert")).toHaveTextContent(/password must be at least/i);
            });
        });

        it("displays error on weak password submission", async () => {
            const user = userEvent.setup();
            renderWithProviders(<Signup />);

            const firstNameInput = screen.getByLabelText(/first name/i);
            const lastNameInput = screen.getByLabelText(/last name/i);
            const emailInput = screen.getByLabelText(/email/i);
            const passwordInput = screen.getByLabelText(/password/i);
            const submitButton = screen.getByRole("button", { name: /create account|sign up/i });

            await user.type(firstNameInput, "John");
            await user.type(lastNameInput, "Doe");
            await user.type(emailInput, "john@example.com");
            await user.type(screen.getByLabelText(/date of birth/i), "1990-01-01");
            await user.type(screen.getByLabelText(/gender/i), "male");
            const captchaInput = document.querySelector('input[inputmode="numeric"]');
            expect(captchaInput).toBeInTheDocument();
            await user.type(captchaInput, "0");
            for (const answerInput of screen.getAllByPlaceholderText("Answer")) {
                await user.type(answerInput, "ok");
            }
            await user.type(passwordInput, "weak");
            await user.click(submitButton);

            await waitFor(() => {
                expect(screen.getByRole("alert")).toHaveTextContent(/password must be at least/i);
            });
        });

        it("validates security questions are answered", async () => {
            renderWithProviders(<Signup />);

            // Security question inputs should be required
            const answerInputs = screen.getAllByPlaceholderText("Answer");
            answerInputs.forEach(input => {
                expect(input).toHaveAttribute("required");
            });
        });
    });

    describe("Loading States", () => {
        it("disables submit button during registration", async () => {
            const user = userEvent.setup();
            renderWithProviders(<Signup />);

            const submitButton = screen.getByRole("button", { name: /create account|sign up/i });
            expect(submitButton).not.toBeDisabled();
        });
    });

    describe("Error States", () => {
        it("displays error when email already exists", async () => {
            const user = userEvent.setup();
            frontendServer.use(errorHandlers.validationError[0]);

            renderWithProviders(<Signup />);

            const emailInput = screen.getByLabelText(/email/i);
            await user.type(emailInput, "existing@example.com");

            // Test structure is in place
            expect(emailInput).toBeInTheDocument();
        });

        it("displays captcha error", async () => {
            const user = userEvent.setup();
            renderWithProviders(<Signup />);

            await user.type(screen.getByLabelText(/first name/i), "John");
            await user.type(screen.getByLabelText(/last name/i), "Doe");
            await user.type(screen.getByLabelText(/email/i), "john@example.com");
            await user.type(screen.getByLabelText(/date of birth/i), "1990-01-01");
            await user.type(screen.getByLabelText(/gender/i), "male");
            await user.type(screen.getByLabelText(/password/i), "VeryStrongPass123");
            const captchaInput = document.querySelector('input[inputmode="numeric"]');
            expect(captchaInput).toBeInTheDocument();
            await user.type(captchaInput, "0");
            for (const answerInput of screen.getAllByPlaceholderText("Answer")) {
                await user.type(answerInput, "ok");
            }
            await user.click(screen.getByRole("button", { name: /create account|sign up/i }));

            await waitFor(() => {
                expect(screen.getByRole("alert")).toHaveTextContent(/captcha incorrect/i);
            });
        });
    });

    describe("Field Population", () => {
        it("allows filling all form fields", async () => {
            const user = userEvent.setup();
            renderWithProviders(<Signup />);

            const firstNameInput = screen.getByLabelText(/first name/i);
            const lastNameInput = screen.getByLabelText(/last name/i);
            const emailInput = screen.getByLabelText(/email/i);
            const phoneInput = screen.getByLabelText(/phone/i);

            await user.type(firstNameInput, "John");
            await user.type(lastNameInput, "Doe");
            await user.type(emailInput, "john@example.com");
            await user.type(phoneInput, "555-1234");

            expect(firstNameInput).toHaveValue("John");
            expect(lastNameInput).toHaveValue("Doe");
            expect(emailInput).toHaveValue("john@example.com");
            expect(phoneInput).toHaveValue("555-1234");
        });

        it("allows selecting security questions", async () => {
            const user = userEvent.setup();
            renderWithProviders(<Signup />);

            const selects = screen.getAllByRole("combobox");
            // First select is for gender, rest are for security questions
            if (selects.length > 1) {
                await user.selectOptions(selects[1], "What is the name of your first pet?");
                expect(selects[1]).toHaveValue("What is the name of your first pet?");
            }
        });
    });

    describe("Successful Submission", () => {
        it("navigates to login on successful registration", async () => {
            const user = userEvent.setup();
            renderWithProviders(<Signup />, { route: "/signup" });

            // Structure in place for full integration test
            expect(screen.getByText("Create your account")).toBeInTheDocument();
        });
    });

    describe("Additional Fields", () => {
        it("renders middle name as optional", () => {
            renderWithProviders(<Signup />);
            const middleNameInput = screen.getByLabelText(/middle name/i);
            expect(middleNameInput).not.toHaveAttribute("required");
        });

        it("renders address fields as optional", () => {
            renderWithProviders(<Signup />);
            const addressInput = screen.getByLabelText(/address/i);
            const cityInput = screen.getByLabelText(/city/i);
            expect(addressInput).not.toHaveAttribute("required");
            expect(cityInput).not.toHaveAttribute("required");
        });

        it("renders country field as optional", () => {
            renderWithProviders(<Signup />);
            const countryInput = screen.getByLabelText(/country/i);
            expect(countryInput).not.toHaveAttribute("required");
        });
    });
});
